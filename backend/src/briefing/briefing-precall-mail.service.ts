import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CalendlyReminderJobData } from '../calendly/calendly-reminder.service';
import { BriefingService } from './briefing.service';
import type { LeadBriefingResponse } from './briefing.types';

@Injectable()
export class BriefingPrecallMailService {
  private readonly log = new Logger(BriefingPrecallMailService.name);

  constructor(
    private readonly briefing: BriefingService,
    private readonly config: ConfigService,
  ) {}

  async send1hBriefingEmail(job: CalendlyReminderJobData): Promise<void> {
    const to = job.consultantEmail?.trim();
    if (!to) {
      this.log.warn(`1h briefing skipped — no consultantEmail for lead ${job.leadId}`);
      return;
    }

    const payload = await this.briefing.getBriefingPayloadByLeadId(job.leadId);
    if (!payload) {
      this.log.warn(`1h briefing skipped — no payload for lead ${job.leadId}`);
      return;
    }

    const key = this.config.get<string>('resendApiKey') ?? '';
    if (!key) {
      this.log.warn('RESEND_API_KEY not set — skip 1h briefing email');
      return;
    }

    const from = this.config.get<string>('resendFromEmail') ?? 'onboarding@resend.dev';
    const crmBase = (this.config.get<string>('crmPublicUrl') ?? '').replace(/\/$/, '');
    const profileUrl = crmBase
      ? `${crmBase}/leads/${job.leadId}`
      : `/leads/${job.leadId}`;

    const subject = `Pre-call briefing: ${job.leadName} · ${this.fmt(job.scheduledAtIso)}`;
    const html = this.renderHtml(payload, profileUrl, job);

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const t = await res.text();
      this.log.error(`Resend briefing email failed: ${res.status} ${t}`);
    }
  }

  private fmt(iso: string): string {
    try {
      return new Date(iso).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return iso;
    }
  }

  private renderHtml(
    b: LeadBriefingResponse,
    profileUrl: string,
    job: CalendlyReminderJobData,
  ): string {
    const score = b.scorecardSummary.totalScore ?? '—';
    const intent = b.scorecardSummary.intentSignal ?? '—';
    const rows = b.scorecardSummary.dimensions
      .map(
        (d) =>
          `<tr><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(d.label)}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right">${d.score} / ${d.max}</td></tr>`,
      )
      .join('');

    const gaps = b.scorecardSummary.gapAreas.length
      ? b.scorecardSummary.gapAreas
          .map(
            (g) =>
              `<li style="margin-bottom:8px"><strong>${escapeHtml(g.title)}</strong> — ${escapeHtml(g.description)}</li>`,
          )
          .join('')
      : '<li>No gap flags</li>';

    const wa = b.conversationSummary
      .slice(-5)
      .map((m) => {
        const who = m.direction === 'inbound' ? 'Lead' : 'Bot';
        return `<p style="margin:6px 0;font-size:13px;color:#374151"><span style="color:#6b7280;font-size:12px">${who} · ${escapeHtml(new Date(m.timestamp).toLocaleString())}</span><br/>${escapeHtml(m.body.slice(0, 400))}</p>`;
      })
      .join('');

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="font-family:system-ui,Segoe UI,sans-serif;background:#f9fafb;padding:24px;color:#111827">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
    <tr><td style="padding:24px 28px;background:#7f1d1d;color:#fff">
      <div style="font-size:18px;font-weight:700">Pre-call briefing</div>
      <div style="opacity:0.9;margin-top:4px;font-size:14px">${escapeHtml(job.leadName)} · ${escapeHtml(this.fmt(job.scheduledAtIso))}</div>
    </td></tr>
    <tr><td style="padding:24px 28px">
      <h2 style="font-size:16px;margin:0 0 12px">Lead at a glance</h2>
      <p style="margin:4px 0"><strong>Score:</strong> ${escapeHtml(String(score))}/100 &nbsp; <strong>Intent:</strong> ${escapeHtml(String(intent))}</p>
      <p style="margin:4px 0;font-size:14px;color:#4b5563">${escapeHtml(b.leadProfile.email ?? '')} · ${escapeHtml(b.leadProfile.phone ?? '')}</p>

      <h2 style="font-size:16px;margin:24px 0 12px">Score breakdown</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px">${rows}</table>

      <h2 style="font-size:16px;margin:24px 0 12px">Gap areas</h2>
      <ul style="padding-left:18px;margin:0">${gaps}</ul>

      <h2 style="font-size:16px;margin:24px 0 12px">WhatsApp (last 5)</h2>
      ${wa || '<p style="color:#6b7280">No messages in bot log.</p>'}

      <h2 style="font-size:16px;margin:24px 0 12px">Talk track</h2>
      <p style="font-size:14px;line-height:1.5;color:#374151">${escapeHtml(b.talkTrack)}</p>

      <p style="margin:28px 0 0">
        <a href="${hrefAttr(profileUrl)}" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px">Open full CRM profile</a>
      </p>
    </td></tr>
  </table>
</body></html>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hrefAttr(url: string): string {
  return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
