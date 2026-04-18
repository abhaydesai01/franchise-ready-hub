import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { approveSendLeadDocument } from '@/lib/api';
import type { Lead, LeadDocumentEntry } from '@/types';
import { toast } from 'sonner';

function apiOrigin(): string {
  const v = import.meta.env.VITE_API_URL ?? '';
  if (v) {
    return v.replace(/\/api\/v1\/?$/i, '').replace(/\/$/, '') || window.location.origin;
  }
  return window.location.origin;
}

function absoluteDocUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = apiOrigin();
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

function statusBadge(status: LeadDocumentEntry['status']) {
  const cls =
    status === 'pending_review'
      ? 'bg-amber-100 text-amber-900'
      : status === 'approved'
        ? 'bg-blue-100 text-blue-800'
        : status === 'signed'
          ? 'bg-emerald-100 text-emerald-900'
          : 'bg-green-100 text-green-800';
  const label =
    status === 'pending_review'
      ? 'Pending review'
      : status === 'approved'
        ? 'Approved'
        : status === 'signed'
          ? 'Signed'
          : 'Sent';
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

export function LeadDocumentsTab({ lead }: { lead: Lead }) {
  const qc = useQueryClient();
  const docs = lead.documents ?? [];

  const approve = useMutation({
    mutationFn: (docEntryId: string) => approveSendLeadDocument(lead.id, docEntryId),
    onSuccess: (updated) => {
      qc.setQueryData(['lead', lead.id], updated);
      qc.invalidateQueries({ queryKey: ['lead', lead.id] });
      toast.success('Document delivery pipeline completed.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!docs.length) {
    return (
      <p className="text-[13px] text-brand-muted py-4">
        No generated documents yet. They appear here after post-call proposal or MOM generation
        completes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {docs.map((d) => (
        <div
          key={d.id}
          className="rounded-lg border border-brand-border p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-semibold text-brand-ink capitalize">
                {d.type === 'proposal' ? 'Proposal' : 'MOM'}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-surface text-brand-muted">
                {d.type}
              </span>
              {statusBadge(d.status)}
            </div>
            <p className="text-[12px] text-brand-muted">
              Generated {d.generatedAt ? new Date(d.generatedAt).toLocaleString() : '—'}
              {d.type === 'proposal' && d.status !== 'pending_review' && d.status !== 'approved' ? (
                <>
                  {' '}
                  · Views: {d.proposalViewCount ?? 0}
                  {d.proposalLastViewedAt
                    ? ` · Last viewed ${new Date(d.proposalLastViewedAt).toLocaleString()}`
                    : ''}
                </>
              ) : null}
              {d.signedAt ? ` · Signed ${new Date(d.signedAt).toLocaleString()}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-[12px] gap-1"
              onClick={() => window.open(absoluteDocUrl(d.url), '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Preview
            </Button>
            {d.status === 'pending_review' && (
              <Button
                type="button"
                size="sm"
                className="text-[12px] bg-brand-crimson hover:bg-brand-crimson-dk gap-1"
                disabled={approve.isPending}
                onClick={() => approve.mutate(d.id)}
              >
                {approve.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Approve & Send
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
