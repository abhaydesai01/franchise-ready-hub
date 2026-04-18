import { useState, useMemo } from 'react';
import { useLeads } from '@/hooks/useLeads';
import { LeadDrawer } from '@/components/crm/LeadDrawer';
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
import { Search, Filter, Download, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLeadHealthMap } from '@/hooks/useLeads';

export default function Leads() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerLeadId, setDrawerLeadId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const limit = 25;

  const { data, isLoading } = useLeads({ search, page, limit });
  const { data: healthMap } = useLeadHealthMap();
  const leads = data?.leads || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === leads.length) setSelectedIds([]);
    else setSelectedIds(leads.map(l => l.id));
  };

  const openLead = (id: string) => {
    setDrawerLeadId(id);
    setDrawerOpen(true);
  };

  if (isLoading) return <SkeletonTable rows={10} />;
  if (!leads.length) return <EmptyState title="No leads yet" description="Add your first lead to get started" />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search leads..."
              className="pl-9 h-9 w-56 text-[13px] border-brand-border focus:border-brand-crimson" />
          </div>
          <Button variant="outline" size="sm" className="text-[12px] border-brand-border gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Filter
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-[12px] border-brand-border gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[10px] border border-brand-border shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-brand-surface hover:bg-brand-surface">
              <TableHead className="w-10">
                <Checkbox checked={selectedIds.length === leads.length && leads.length > 0}
                  onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">Name</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">Health</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">Phone</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">Track</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">Stage</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">Score</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">SLA</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase text-brand-muted tracking-wider">Last Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead, i) => {
              const isSelected = selectedIds.includes(lead.id);
              const health = healthMap?.[lead.id];
              return (
                <TableRow key={lead.id}
                  className={`cursor-pointer transition-colors ${isSelected ? 'bg-brand-crimson-lt' : i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF8]'} hover:bg-brand-surface`}
                  onClick={() => openLead(lead.id)}
                >
                  <TableCell onClick={e => e.stopPropagation()}>
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
                  <TableCell><TrackPill track={lead.track} /></TableCell>
                  <TableCell><StagePill stage={lead.stage} /></TableCell>
                  <TableCell><ScoreBadge score={lead.score} /></TableCell>
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-brand-muted">
          Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} leads
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="border-brand-border h-8 w-8 p-0">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map(p => (
            <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm"
              onClick={() => setPage(p)}
              className={`h-8 w-8 p-0 text-[12px] ${p === page ? 'bg-brand-crimson text-white' : 'border-brand-border'}`}>
              {p}
            </Button>
          ))}
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
            className="border-brand-border h-8 w-8 p-0">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <LeadDrawer leadId={drawerLeadId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
