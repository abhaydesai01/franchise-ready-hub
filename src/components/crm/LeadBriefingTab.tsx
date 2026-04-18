import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadLeadBriefingPdf } from '@/lib/api';
import type { LeadBriefing } from '@/types';
import { toast } from 'sonner';
import { useLeadBriefing } from '@/hooks/useLeads';

function bandLabel(b: string | null): string {
  if (!b) return '—';
  return b.replace(/_/g, ' ');
}

export function LeadBriefingTab({ leadId }: { leadId: string }) {
  const { data, isLoading, error } = useLeadBriefing(leadId, true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-brand-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading briefing…
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-[13px] text-red-600 py-4">
        {(error as Error).message || 'Briefing unavailable.'}
      </p>
    );
  }

  if (!data) return null;

  return (
    <BriefingContent
      briefing={data}
      leadId={leadId}
    />
  );
}

function BriefingContent({ briefing, leadId }: { briefing: LeadBriefing; leadId: string }) {
  const onPdf = async () => {
    try {
      await downloadLeadBriefingPdf(leadId);
      toast.success('Briefing PDF downloaded');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const p = briefing.leadProfile;
  const s = briefing.scorecardSummary;
  const c = briefing.callDetails;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-[12px] gap-1.5 border-brand-border"
          onClick={() => void onPdf()}
        >
          <Download className="w-3.5 h-3.5" />
          Download briefing as PDF
        </Button>
      </div>

      <section>
        <h4 className="text-[12px] font-semibold text-brand-muted uppercase tracking-wide mb-2">
          Lead at a glance
        </h4>
        <div className="rounded-lg border border-brand-border bg-brand-surface/40 p-4 space-y-2 text-[13px]">
          <div className="flex justify-between gap-2">
            <span className="text-brand-muted">Score</span>
            <span className="font-semibold text-brand-ink">
              {s.totalScore ?? '—'}/100
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-brand-muted">Intent</span>
            <span>{s.intentSignal ?? '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-brand-muted">Email</span>
            <span className="text-right break-all">{p.email ?? '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-brand-muted">Phone</span>
            <span>{p.phone ?? '—'}</span>
          </div>
          {p.company && (
            <div className="flex justify-between gap-2">
              <span className="text-brand-muted">Company</span>
              <span>{p.company}</span>
            </div>
          )}
          {p.metaAdSource && (
            <div className="flex justify-between gap-2">
              <span className="text-brand-muted">Meta / source</span>
              <span className="text-right text-[12px]">{p.metaAdSource}</span>
            </div>
          )}
          {p.utmCampaign && (
            <div className="flex justify-between gap-2">
              <span className="text-brand-muted">UTM campaign</span>
              <span className="text-right text-[12px]">{p.utmCampaign}</span>
            </div>
          )}
        </div>
      </section>

      <section>
        <h4 className="text-[12px] font-semibold text-brand-muted uppercase tracking-wide mb-2">
          Call details
        </h4>
        <div className="text-[13px] space-y-1">
          <p>
            <span className="text-brand-muted">When: </span>
            {c.scheduledAt
              ? new Date(c.scheduledAt).toLocaleString()
              : '—'}
          </p>
          <p>
            <span className="text-brand-muted">Consultant: </span>
            {c.consultantName ?? '—'}
          </p>
          {c.meetingLink && (
            <a
              href={c.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="text-brand-crimson text-[13px] hover:underline break-all"
            >
              Meeting link
            </a>
          )}
        </div>
      </section>

      <section>
        <h4 className="text-[12px] font-semibold text-brand-muted uppercase tracking-wide mb-2">
          Score breakdown
        </h4>
        <div className="rounded-lg border border-brand-border overflow-hidden">
          <table className="w-full text-[12px]">
            <tbody>
              {s.dimensions.map((d) => (
                <tr key={d.label} className="border-b border-brand-border last:border-0">
                  <td className="p-2.5 text-brand-text">{d.label}</td>
                  <td className="p-2.5 text-right text-brand-muted">
                    {d.score} / {d.max}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-brand-muted mt-2">
          Readiness: {bandLabel(s.readinessBand)}
        </p>
      </section>

      <section>
        <h4 className="text-[12px] font-semibold text-brand-muted uppercase tracking-wide mb-2">
          Gap areas
        </h4>
        {s.gapAreas.length === 0 ? (
          <p className="text-[13px] text-brand-muted">None flagged.</p>
        ) : (
          <ul className="space-y-2 text-[13px]">
            {s.gapAreas.map((g) => (
              <li key={g.title} className="border-l-2 border-brand-crimson/40 pl-3">
                <span className="font-medium text-brand-ink">{g.title}</span>
                <span className="text-brand-muted"> — {g.description}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="text-[12px] font-semibold text-brand-muted uppercase tracking-wide mb-2">
          WhatsApp (last 20)
        </h4>
        <div className="max-h-[220px] overflow-y-auto space-y-2 rounded-lg border border-brand-border p-3 bg-brand-surface/30">
          {briefing.conversationSummary.length === 0 ? (
            <p className="text-[13px] text-brand-muted">No bot messages logged.</p>
          ) : (
            briefing.conversationSummary.map((m, i) => (
              <div
                key={`${m.timestamp}-${i}`}
                className={`text-[12px] rounded-md p-2 ${
                  m.direction === 'inbound'
                    ? 'bg-white border border-brand-border ml-4'
                    : 'bg-brand-surface mr-4'
                }`}
              >
                <div className="text-[10px] text-brand-muted mb-0.5">
                  {m.direction === 'inbound' ? 'Lead' : 'Bot'} ·{' '}
                  {new Date(m.timestamp).toLocaleString()}
                </div>
                <div className="text-brand-text whitespace-pre-wrap break-words">{m.body}</div>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h4 className="text-[12px] font-semibold text-brand-muted uppercase tracking-wide mb-2">
          Talk track
        </h4>
        <p className="text-[13px] text-brand-text leading-relaxed border border-brand-border rounded-lg p-4 bg-amber-50/80">
          {briefing.talkTrack}
        </p>
      </section>
    </div>
  );
}
