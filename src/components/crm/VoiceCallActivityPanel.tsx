import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Play } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { TrackPill } from '@/components/crm/TrackPill';
import { StagePill } from '@/components/crm/StagePill';
import { SkeletonTable } from '@/components/crm/SkeletonCard';
import { EmptyState } from '@/components/crm/EmptyState';
import { useVoiceCallActivity } from '@/hooks/useCalls';
import { useRefreshLeadVoiceFromVaani } from '@/hooks/useLeads';
import { fetchLeadVoiceRecordingUrl } from '@/lib/api';
import { toast } from 'sonner';
import type { VoiceCallActivityItem } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const LIMIT = 20;

function RowDetails({ item }: { item: VoiceCallActivityItem }) {
  const { call } = item;
  const [open, setOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  return (
    <>
      <TableRow className="align-top">
        <TableCell className="text-[12px] text-brand-muted whitespace-nowrap">
          {call.triggeredAt
            ? new Date(call.triggeredAt).toLocaleString('en-IN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'}
        </TableCell>
        <TableCell>
          <div className="text-[14px] font-semibold text-brand-ink leading-tight">{item.leadName}</div>
          <div className="text-[11px] text-brand-muted font-mono mt-0.5">{item.leadPhone}</div>
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-1">
            <TrackPill track={item.leadTrack} />
            <StagePill stage={item.leadStage} />
          </div>
        </TableCell>
        <TableCell>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-surface capitalize">
            {call.status || '—'}
          </span>
        </TableCell>
        <TableCell>
          {call.outcome ? (
            <span className="text-[12px] text-brand-ink capitalize">
              {call.outcome.replace(/_/g, ' ')}
            </span>
          ) : (
            <span className="text-[12px] text-brand-muted">—</span>
          )}
        </TableCell>
        <TableCell className="max-w-[220px]">
          {call.summary ? (
            <>
              <button
                type="button"
                onClick={() => setSummaryOpen(true)}
                className="text-left w-full text-[12px] text-brand-text line-clamp-2 leading-snug cursor-pointer rounded-sm border border-transparent px-0.5 -mx-0.5 py-0.5 transition-colors hover:bg-brand-surface/80 hover:border-brand-border/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-crimson/35"
                title="Click to read full summary"
              >
                {call.summary}
              </button>
              <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Call summary</DialogTitle>
                    <DialogDescription className="sr-only">
                      Full call summary for {item.leadName}
                    </DialogDescription>
                  </DialogHeader>
                  <p className="text-sm text-brand-text whitespace-pre-wrap leading-relaxed pr-1">{call.summary}</p>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <p className="text-[12px] text-brand-muted">No summary yet — sync from Optimizer</p>
          )}
        </TableCell>
        <TableCell>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-[11px] text-brand-crimson font-medium hover:underline"
          >
            {open ? 'Hide' : 'Transcript & room'}
          </button>
        </TableCell>
        <RowActions item={item} />
      </TableRow>
      {open && (
        <TableRow className="bg-brand-surface/50">
          <TableCell colSpan={8} className="p-4 text-[12px]">
            <p className="text-[11px] font-mono text-brand-muted break-all mb-2">Room: {call.vaaniCallId}</p>
            {call.vaaniDispatchId && (
              <p className="text-[11px] font-mono text-brand-muted break-all mb-2">
                Dispatch: {call.vaaniDispatchId}
              </p>
            )}
            {call.transcript ? (
              <p className="whitespace-pre-wrap text-brand-text border-t border-brand-border pt-2 mt-1">
                {call.transcript}
              </p>
            ) : (
              <p className="text-brand-muted">No transcript yet. Use “Sync from Optimizer” or wait for post-call sync.</p>
            )}
            {Object.keys(call.entities ?? {}).length > 0 && (
              <pre className="mt-2 p-2 rounded bg-white border border-brand-border text-[11px] overflow-x-auto">
                {JSON.stringify(call.entities, null, 2)}
              </pre>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function RowActions({ item }: { item: VoiceCallActivityItem }) {
  const navigate = useNavigate();
  const sync = useRefreshLeadVoiceFromVaani();
  return (
    <TableCell onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap gap-1 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1"
          onClick={() => navigate(`/leads/${item.leadId}`)}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Lead
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1"
          disabled={sync.isPending}
          onClick={async () => {
            try {
              await sync.mutateAsync({ leadId: item.leadId, vaaniCallId: item.call.vaaniCallId });
              toast.success('Synced from Optimizer');
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Sync failed');
            }
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${sync.isPending ? 'animate-spin' : ''}`} />
          Sync
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1"
          onClick={async () => {
            try {
              const { url } = await fetchLeadVoiceRecordingUrl(item.leadId, item.call.vaaniCallId);
              window.open(url, '_blank', 'noopener,noreferrer');
            } catch {
              toast.error('Recording not available');
            }
          }}
        >
          <Play className="w-3.5 h-3.5" />
          Play
        </Button>
      </div>
    </TableCell>
  );
}

export function VoiceCallActivityPanel() {
  const [page, setPage] = useState(1);
  const [searchIn, setSearchIn] = useState('');
  const [debounced, setDebounced] = useState('');
  const { data, isLoading, isFetching } = useVoiceCallActivity({ page, limit: LIMIT, search: debounced });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchIn.trim()), 400);
    return () => clearTimeout(t);
  }, [searchIn]);

  useEffect(() => {
    setPage(1);
  }, [debounced]);

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const go = useCallback((p: number) => setPage(Math.max(1, Math.min(p, totalPages))), [totalPages]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <Input
              value={searchIn}
              onChange={(e) => setSearchIn(e.target.value)}
              placeholder="Search by lead name or phone…"
              className="pl-9 h-9 text-[13px] border-brand-border"
            />
          </div>
          {!isLoading && (
            <span className="text-[12px] text-brand-muted whitespace-nowrap">
              {total} attempt{total === 1 ? '' : 's'}
              {debounced ? ` matching “${debounced}”` : ' (your scope)'}
            </span>
          )}
        </div>
        {isFetching && !isLoading && <span className="text-[11px] text-brand-muted">Updating…</span>}
      </div>
      {isLoading ? (
        <SkeletonTable rows={6} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No Optimizer calls yet"
          description="Dispatch a call from any lead, or wait for the voice-fallback queue. If you use a rep account, you only see leads in your scope (admins see all). Configure Optimizer under Settings → Integrations."
        />
      ) : (
        <>
          <div className="bg-white rounded-[10px] border border-brand-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-brand-surface">
                  <TableHead className="text-[10px] font-semibold uppercase text-brand-muted w-[100px]">When</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-brand-muted">Lead</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-brand-muted">Track / stage</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-brand-muted">Status</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-brand-muted">Outcome</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-brand-muted min-w-[180px]">Summary</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-brand-muted w-[100px]">Details</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase text-brand-muted text-right w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <RowDetails key={`${item.leadId}-${item.call.vaaniCallId}`} item={item} />
                ))}
              </TableBody>
            </Table>
          </div>
          {total > LIMIT && (
            <div className="flex items-center justify-between text-[13px] text-brand-muted">
              <span>
                Page {page} of {totalPages} · {total} call{total === 1 ? '' : 's'}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => go(page - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={page >= totalPages}
                  onClick={() => go(page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
