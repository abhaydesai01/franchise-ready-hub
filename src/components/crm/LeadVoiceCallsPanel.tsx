import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Lead } from '@/types';
import { fetchLeadVoiceRecordingUrl } from '@/lib/api';
import { useRefreshLeadVoiceFromVaani, useTriggerVaaniTestCall } from '@/hooks/useLeads';
import { toast } from 'sonner';
import { Phone, RefreshCw } from 'lucide-react';

type LeadVoiceCallsPanelProps = {
  lead: Lead;
  /** When false, only show the call history (e.g. read-only embed). Default true. */
  showTestCall?: boolean;
};

export function LeadVoiceCallsPanel({ lead, showTestCall = true }: LeadVoiceCallsPanelProps) {
  const [phoneOverride, setPhoneOverride] = useState('');
  const testCall = useTriggerVaaniTestCall();
  const syncVaani = useRefreshLeadVoiceFromVaani();

  const onTestCall = async () => {
    const trimmed = phoneOverride.trim();
    try {
      await testCall.mutateAsync({
        leadId: lead.id,
        phoneOverride: trimmed ? trimmed : undefined,
      });
      setPhoneOverride('');
      toast.success('Call dispatch started — data will appear after the call and API sync');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not start call';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-3">
      {showTestCall && (
        <div className="rounded-lg border border-brand-border bg-brand-surface/50 p-3 space-y-2">
          <p className="text-[12px] text-brand-muted">
            <span className="font-medium text-brand-ink">Dispatch now</span> — places a real Optimizer outbound call
            (same as the scheduled voice-fallback job). Transcript and call details are stored from Optimizer’s APIs
            after the call. Requires Optimizer in Settings, a valid phone, and your max-attempts limit.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] text-brand-muted" htmlFor={`vaani-override-${lead.id}`}>
                Optional phone override
              </label>
              <Input
                id={`vaani-override-${lead.id}`}
                className="text-[13px] h-8 border-brand-border"
                placeholder={lead.phone || 'E.164 or local'}
                value={phoneOverride}
                onChange={(e) => setPhoneOverride(e.target.value)}
                disabled={testCall.isPending}
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 text-[12px] bg-brand-crimson hover:bg-brand-crimson-dk text-white gap-1.5 shrink-0"
              onClick={onTestCall}
              disabled={testCall.isPending}
            >
              <Phone className="w-3.5 h-3.5" />
              {testCall.isPending ? 'Dispatching…' : 'Dispatch call now'}
            </Button>
          </div>
        </div>
      )}

      {(lead.voiceCalls?.length ?? 0) === 0 ? (
        <p className="text-[13px] text-brand-muted">No Optimizer voice calls yet.</p>
      ) : (
        (lead.voiceCalls ?? []).map((vc, idx) => (
          <div
            key={`${vc.vaaniCallId}-${idx}`}
            className="rounded-lg border border-brand-border p-3 space-y-2 text-[13px]"
          >
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <span className="font-semibold text-brand-ink">Attempt {idx + 1}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-surface text-brand-text capitalize">
                {vc.status || '—'}
              </span>
            </div>
            <div className="grid gap-1 text-[12px] text-brand-muted">
              <span className="font-mono text-[11px] break-all" title="Optimizer room (stream / transcript / call details)">
                Room: {vc.vaaniCallId}
              </span>
              {vc.vaaniDispatchId && (
                <span className="font-mono text-[11px] break-all">
                  Dispatch: {vc.vaaniDispatchId}
                </span>
              )}
              {vc.lastEnrichedAt && (
                <span>
                  Last synced: {new Date(vc.lastEnrichedAt).toLocaleString('en-IN')}
                </span>
              )}
              <span>
                Trigger: {(vc.triggerReason || '—').replace(/_/g, ' ')} ·{' '}
                {vc.triggeredAt ? new Date(vc.triggeredAt).toLocaleString('en-IN') : '—'}
              </span>
              {vc.duration > 0 && <span>Duration: {vc.duration}s</span>}
              {vc.outcome ? (
                <span>
                  Outcome:{' '}
                  <span className="text-brand-ink capitalize">{vc.outcome.replace(/_/g, ' ')}</span>
                </span>
              ) : null}
              {vc.sentiment ? (
                <span>
                  Sentiment: <span className="text-brand-ink">{vc.sentiment}</span>
                </span>
              ) : null}
            </div>
            {vc.callEvalTag ? (
              <p className="text-[12px] text-brand-text">
                <span className="text-brand-muted">Call tag: </span>
                {vc.callEvalTag}
              </p>
            ) : null}
            {vc.summary ? (
              <p className="text-[12px] text-brand-text border-t border-brand-border pt-2">
                <span className="text-brand-muted">Summary: </span>
                {vc.summary}
              </p>
            ) : null}
            {Object.keys(vc.conversationEval ?? {}).length > 0 && (
              <details className="text-[12px]">
                <summary className="cursor-pointer text-brand-crimson font-medium">Conversation eval</summary>
                <pre className="mt-2 p-2 rounded bg-brand-surface overflow-x-auto text-[11px]">
                  {JSON.stringify(vc.conversationEval, null, 2)}
                </pre>
              </details>
            )}
            {Object.keys(vc.entities ?? {}).length > 0 && (
              <details className="text-[12px]">
                <summary className="cursor-pointer text-brand-crimson font-medium">Entities (from Optimizer)</summary>
                <pre className="mt-2 p-2 rounded bg-brand-surface overflow-x-auto text-[11px]">
                  {JSON.stringify(vc.entities, null, 2)}
                </pre>
              </details>
            )}
            {vc.transcript ? (
              <details className="text-[12px]">
                <summary className="cursor-pointer text-brand-crimson font-medium">Transcript</summary>
                <p className="mt-2 whitespace-pre-wrap text-brand-text">{vc.transcript}</p>
              </details>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="text-[11px] h-7 gap-1"
                onClick={async () => {
                  try {
                    await syncVaani.mutateAsync({
                      leadId: lead.id,
                      vaaniCallId: vc.vaaniCallId,
                    });
                    toast.success('Pulled latest transcript and call details from Optimizer');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Sync failed');
                  }
                }}
                disabled={syncVaani.isPending}
              >
                <RefreshCw className={`w-3 h-3 ${syncVaani.isPending ? 'animate-spin' : ''}`} />
                Sync from Optimizer
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-[11px] h-7 border-brand-border"
                onClick={async () => {
                  try {
                    const { url } = await fetchLeadVoiceRecordingUrl(lead.id, vc.vaaniCallId);
                    window.open(url, '_blank', 'noopener,noreferrer');
                  } catch {
                    toast.error('Recording not available');
                  }
                }}
              >
                Play recording
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
