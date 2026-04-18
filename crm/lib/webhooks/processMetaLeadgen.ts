import { verifyWebhookSignature, formatPhone } from '@/lib/whatsapp';
import { connectDB } from '@/lib/mongodb';
import { Lead } from '@/models/Lead';
import { WebhookEvent } from '@/models/WebhookEvent';
import { sendWarmIntroForLead } from '@/lib/bot/conversationEngine';

const GRAPH = 'https://graph.facebook.com/v19.0';

function normalizeMetaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function pickField(
  fieldData: Array<{ name?: string; values?: string[] }>,
  names: string[],
): string | undefined {
  for (const f of fieldData) {
    const n = (f.name ?? '').toLowerCase().replace(/\s+/g, '_');
    if (names.some((x) => n === x || n.includes(x))) {
      const v = f.values?.[0];
      if (v) return v;
    }
  }
  return undefined;
}

async function fetchLeadgen(leadgenId: string): Promise<{ field_data?: Array<{ name?: string; values?: string[] }> }> {
  const token =
    process.env.META_PAGE_ACCESS_TOKEN ||
    process.env.WHATSAPP_ACCESS_TOKEN ||
    process.env.META_SYSTEM_USER_TOKEN;
  if (!token) {
    console.error('[meta] No access token for Graph API');
    return {};
  }
  const url = `${GRAPH}/${encodeURIComponent(leadgenId)}?fields=field_data&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('[meta] leadgen fetch failed', res.status, await res.text());
    return {};
  }
  return (await res.json()) as { field_data?: Array<{ name?: string; values?: string[] }> };
}

export async function processMetaPayload(raw: string, signatureHeader: string | null): Promise<boolean> {
  if (!verifyWebhookSignature(raw, signatureHeader)) return false;
  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    return true;
  }

  void (async () => {
    try {
      await connectDB();
      const root = payload as {
        entry?: Array<{
          changes?: Array<{
            field?: string;
            value?: { leadgen_id?: string; form_id?: string; adgroup_id?: string; ad_id?: string };
          }>;
        }>;
      };

      for (const entry of root.entry ?? []) {
        for (const change of entry.changes ?? []) {
          if (change.field !== 'leadgen') continue;
          const leadgenId = change.value?.leadgen_id;
          if (!leadgenId) continue;
          const eventKey = `meta:leadgen:${leadgenId}`;

          const existingEvent = await WebhookEvent.findOne({ eventKey }).lean();
          if (existingEvent?.status === 'processed') {
            continue;
          }

          await WebhookEvent.updateOne(
            { eventKey },
            {
              $setOnInsert: {
                source: 'meta',
                payload: change,
                status: 'received',
                attempts: 0,
              },
            },
            { upsert: true },
          );

          await WebhookEvent.updateOne(
            { eventKey },
            { $set: { status: 'processing' }, $inc: { attempts: 1 } },
          );

          const graphLead = await fetchLeadgen(leadgenId);
          const fd = graphLead.field_data ?? [];
          const fullName =
            pickField(fd, ['full_name', 'first_name', 'name']) ?? 'Meta lead';
          const phoneRaw = pickField(fd, ['phone_number', 'phone', 'mobile']) ?? '';
          const emailRaw = pickField(fd, ['email', 'work_email'])?.toLowerCase().trim();
          const companyRaw = pickField(fd, ['company', 'business_name', 'organization'])?.trim();
          const cityRaw = pickField(fd, ['city', 'location', 'state'])?.trim();
          const budgetRaw = pickField(fd, ['budget', 'investment', 'capital'])?.trim();

          const phone = phoneRaw ? normalizeMetaPhone(phoneRaw) : '';
          const normalizedPhone = phone ? formatPhone(phone) : '';
          const existingLead = await Lead.findOne({
            $or: [
              ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
              ...(emailRaw ? [{ email: emailRaw }] : []),
              { metaLeadId: leadgenId },
            ],
          });

          const lead = existingLead
            ? await Lead.findOneAndUpdate(
                { _id: existingLead._id },
                {
                  $set: {
                    name: existingLead.name || fullName,
                    ...(normalizedPhone ? { phone: normalizedPhone } : {}),
                    ...(emailRaw ? { email: emailRaw } : {}),
                    ...(companyRaw ? { company: companyRaw } : {}),
                    source: existingLead.source || 'meta_ad',
                    metaLeadId: leadgenId,
                    metaFormId: change.value?.form_id,
                    ...(cityRaw || budgetRaw
                      ? {
                          notes: [
                            existingLead.notes,
                            cityRaw ? `City: ${cityRaw}` : '',
                            budgetRaw ? `Budget: ${budgetRaw}` : '',
                          ]
                            .filter(Boolean)
                            .join(' | '),
                        }
                      : {}),
                    lastActivityType: 'meta_lead_updated',
                    lastActivity: new Date().toISOString(),
                  },
                },
                { new: true },
              )
            : await Lead.create({
                name: fullName,
                ...(normalizedPhone ? { phone: normalizedPhone } : {}),
                ...(emailRaw ? { email: emailRaw } : {}),
                ...(companyRaw ? { company: companyRaw } : {}),
                source: 'meta_ad',
                track: 'not_ready',
                stage: 'new',
                status: 'new',
                score: 0,
                scoreDimensions: [],
                metaLeadId: leadgenId,
                metaFormId: change.value?.form_id,
                notes: [
                  !normalizedPhone
                    ? 'Meta lead created without phone number. Needs enrichment before WhatsApp outreach.'
                    : '',
                  cityRaw ? `City: ${cityRaw}` : '',
                  budgetRaw ? `Budget: ${budgetRaw}` : '',
                ]
                  .filter(Boolean)
                  .join(' | ') || undefined,
              });
          if (!lead) {
            await WebhookEvent.updateOne(
              { eventKey },
              { $set: { status: 'failed', error: 'Lead create/update returned null' } },
            );
            continue;
          }

          const canWhatsApp = Boolean(normalizedPhone);

          if (canWhatsApp) {
            try {
              await sendWarmIntroForLead(String(lead._id));
            } catch (e) {
              console.error('[meta] warm intro send failed', e);
            }
          }

          await WebhookEvent.updateOne(
            { eventKey },
            {
              $set: {
                status: 'processed',
                processedAt: new Date(),
              },
            },
          );
        }
      }
    } catch (e) {
      try {
        await connectDB();
        const root = payload as {
          entry?: Array<{
            changes?: Array<{ field?: string; value?: { leadgen_id?: string } }>;
          }>;
        };
        for (const entry of root.entry ?? []) {
          for (const change of entry.changes ?? []) {
            const leadgenId = change.value?.leadgen_id;
            if (!leadgenId) continue;
            await WebhookEvent.updateOne(
              { eventKey: `meta:leadgen:${leadgenId}` },
              {
                $set: { status: 'failed', error: e instanceof Error ? e.message : String(e) },
              },
            );
          }
        }
      } catch {
        // no-op
      }
      console.error('[meta] async processing error', e);
    }
  })();

  return true;
}
