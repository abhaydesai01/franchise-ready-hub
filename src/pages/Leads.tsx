import { useState, useRef } from 'react';
import { useLeads, useLeadHealthMap, useDeleteLeadsBulk, useImportLeads } from '@/hooks/useLeads';
import { LeadDrawer } from '@/components/crm/LeadDrawer';
import { DispatchVaaniCallButton } from '@/components/crm/DispatchVaaniCallButton';
import { ScoreBadge } from '@/components/crm/ScoreBadge';
import { TrackPill } from '@/components/crm/TrackPill';
import { StagePill } from '@/components/crm/StagePill';
import { LeadHealthBadge, SLABadge } from '@/components/crm/LeadHealthBadge';
import { SkeletonTable } from '@/components/crm/SkeletonCard';
import { EmptyState } from '@/components/crm/EmptyState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Filter, Download, MessageCircle, ChevronLeft, ChevronRight, Phone, Trash2, Upload } from 'lucide-react';
import { parseLeadsCsvToRows } from '@/lib/parseLeadsCsv';
import { toast } from 'sonner';

const CSV_TEMPLATE = `name,phone,email,company,source,notes
Example Lead,+919999999999,example@email.com,Acme Co,Meta,`;

export default function Leads() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const limit = 25;

  const { data, isLoading } = useLeads({ search, page, limit });
  const { data: healthMap } = useLeadHealthMap();
  const removeBulk = useDeleteLeadsBulk();
  const doImport = useImportLeads();

  const leads = data?.leads || [];
  const total = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (selectedIds.length === leads.length) setSelectedIds([]);
    else setSelectedIds(leads.map((l) => l.id));
  };

  const openLead = (id: string) => {
    setDrawerLeadId(id);
    setDrawerOpen(true);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onPickFile = () => fileInputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const text = await f.text();
    const rows = parseLeadsCsvToRows(text);
    if (!rows.length) {
      toast.error('No valid rows. Use a header row with at least a "name" column. Download the template to see the format.');
      return;
    }
    try {
      const r = await doImport.mutateAsync(rows);
      if (r.failed.length) {
        toast.warning(
          `Imported ${r.created} lead(s). ${r.failed.length} row(s) failed (see first: ${r.failed[0]?.message ?? ''}).`,
        );
      } else {
        toast.success(`Imported ${r.created} lead(s).`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const runDelete = async () => {
    if (!selectedIds.length) return;
    try {
      const r = await removeBulk.mutateAsync(selectedIds);
      if (r.removed === 0) {
        toast.error('No leads were deleted. You may not have permission to delete them.');
      } else {
        toast.success(`Deleted ${r.removed} lead(s).`);
      }
      setSelectedIds([]);
      setDeleteOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const showTable = !isLoading && leads.length > 0;
  const showEmpty = !isLoading && leads.length === 0;

  if (isLoading) return <SkeletonTable rows={10} />;

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onFile}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search leads…"
              className="pl-9 h-9 w-56 text-[13px] border-brand-border focus:border-brand-crimson"
            />
          </div>
          <Button variant="outline" size="sm" className="text-[12px] border-brand-border gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Filter
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-[12px] border-red-200 text-red-700 hover:bg-red-50 gap-1.5"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete ({selectedIds.length})
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-[12px] border-brand-border gap-1.5"
            onClick={onPickFile}
            disabled={doImport.isPending}
          >
            <Upload className="w-3.5 h-3.5" /> {doImport.isPending ? 'Importing…' : 'Import CSV'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-[12px] text-brand-muted h-8"
            onClick={downloadTemplate}
          >
            Template
          </Button>
          <Button variant="outline" size="sm" className="text-[12px] border-brand-border gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} lead(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Activity history for these leads will be removed. Calendar bookings, if
              any, are cancelled on the next sync where supported.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => void runDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showEmpty && (
        <div className="bg-white rounded-[10px] border border-brand-border p-8">
          <EmptyState
            title="No leads in this list"
            description="Import a CSV (name, phone, email, …) or add a lead from the + Add Lead button."
          />
        </div>
      )}

      {showTable && (
        <div className="bg-white rounded-[10px] border border-brand-border shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-brand-surface hover:bg-brand-surface">
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.length === leads.length && leads.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">
                  Health
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">
                  Phone
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">
                  Track
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">
                  Stage
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">
                  Score
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">
                  Voice
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">
                  SLA
                </TableHead>
                <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">
                  Last Activity
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead, i) => {
                const isSelected = selectedIds.includes(lead.id);
                const health = healthMap?.[lead.id];
                const voiceList = lead.voiceCalls ?? [];
                const lastVoice = voiceList.length ? voiceList[voiceList.length - 1]! : null;
                return (
                  <TableRow
                    key={lead.id}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-brand-crimson-lt' : i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF8]'
                    } hover:bg-brand-surface`}
                    onClick={() => openLead(lead.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(lead.id)} />
                    </TableCell>
                    <TableCell className="text-[14px] font-semibold text-brand-ink">{lead.name}</TableCell>
                    <TableCell>
                      {health ? <LeadHealthBadge temperature={health.temperature} /> : <span className="text-[11px] text-brand-muted">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <MessageCircle className="w-3 h-3 text-green-600" />
                        <span className="text-[13px] text-brand-text">{lead.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <TrackPill track={lead.track} />
                    </TableCell>
                    <TableCell>
                      <StagePill stage={lead.stage} />
                    </TableCell>
                    <TableCell>
                      <ScoreBadge score={lead.score} />
                    </TableCell>
                    <TableCell>
                      {voiceList.length === 0 ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[11px] text-brand-muted">—</span>
                          <DispatchVaaniCallButton leadId={lead.id} variant="icon" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 justify-end">
                          <Phone className="w-3.5 h-3.5 text-brand-muted shrink-0" />
                          <span className="text-[12px] text-brand-text">{voiceList.length}</span>
                          {lastVoice?.outcome ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-surface text-brand-muted capitalize max-w-[100px] truncate">
                              {lastVoice.outcome.replace(/_/g, ' ')}
                            </span>
                          ) : null}
                          <DispatchVaaniCallButton leadId={lead.id} variant="icon" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {health ? <SLABadge state={health.sla.followUpState} compact /> : <span className="text-[11px] text-brand-muted">—</span>}
                    </TableCell>
                    <TableCell className="text-[12px] text-brand-muted">{lead.lastActivity}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[13px] text-brand-muted">
          {total > 0
            ? `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total} lead${total === 1 ? '' : 's'}`
            : '0 leads'}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="border-brand-border h-8 w-8 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, j) => j + 1)
            .slice(0, 5)
            .map((p) => (
              <Button
                key={p}
                variant={p === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPage(p)}
                className={`h-8 w-8 p-0 text-[12px] ${
                  p === page ? 'bg-brand-crimson text-white' : 'border-brand-border'
                }`}
              >
                {p}
              </Button>
            ))}
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="border-brand-border h-8 w-8 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <LeadDrawer leadId={drawerLeadId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
