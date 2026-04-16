import { useState, useMemo, useCallback } from 'react';
import { useLeads, useUpdateLeadStage } from '@/hooks/useLeads';
import { LeadCard } from '@/components/crm/LeadCard';
import { LeadDrawer } from '@/components/crm/LeadDrawer';
import { SkeletonCard } from '@/components/crm/SkeletonCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { getTrackColors } from '@/lib/utils';
import type { Lead, Track, Stage } from '@/types';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface TrackConfig {
  track: Track;
  stages: Stage[];
}

const trackConfigs: TrackConfig[] = [
  { track: 'Not Ready', stages: ['Gap Nurture', 'Not Early', 'Discovery Call', 'Convert to Consulting'] },
  { track: 'Franchise Ready', stages: ['Discovery Booked', 'Reminders Sent', 'Proposal Sent', 'Signed'] },
  { track: 'Recruitment Only', stages: ['Routed to Eden'] },
];

// Build a lookup: stage → track
const stageToTrack: Record<string, Track> = {};
trackConfigs.forEach(tc => tc.stages.forEach(s => { stageToTrack[s] = tc.track; }));

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] rounded-lg transition-colors ${isOver ? 'bg-brand-crimson/5 ring-1 ring-brand-crimson/20' : ''}`}
    >
      {children}
    </div>
  );
}

function SortableLeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { lead },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <LeadCard lead={lead} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}

export default function Pipeline() {
  const { data, isLoading } = useLeads();
  const updateStage = useUpdateLeadStage();
  const [activeTrack, setActiveTrack] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDragLead, setActiveDragLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const leads = data?.leads || [];

  const filteredLeads = useMemo(() => {
    let filtered = [...leads];
    if (activeTrack !== 'All') filtered = filtered.filter(l => l.track === activeTrack);
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(l => l.name.toLowerCase().includes(s) || l.phone.includes(s));
    }
    if (sort === 'score') filtered.sort((a, b) => b.score - a.score);
    return filtered;
  }, [leads, activeTrack, search, sort]);

  const trackCounts = useMemo(() => ({
    'All': leads.length,
    'Not Ready': leads.filter(l => l.track === 'Not Ready').length,
    'Franchise Ready': leads.filter(l => l.track === 'Franchise Ready').length,
    'Recruitment Only': leads.filter(l => l.track === 'Recruitment Only').length,
  }), [leads]);

  const getLeadsForStage = useCallback((track: Track, stage: Stage) =>
    filteredLeads.filter(l => l.track === track && l.stage === stage),
    [filteredLeads]
  );

  const openLead = (lead: Lead) => {
    setSelectedLeadId(lead.id);
    setDrawerOpen(true);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const lead = event.active.data.current?.lead as Lead | undefined;
    if (lead) setActiveDragLead(lead);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragLead(null);
    const { active, over } = event;
    if (!over) return;

    const draggedLead = active.data.current?.lead as Lead | undefined;
    if (!draggedLead) return;

    // The droppable id is "track::stage"
    const overId = over.id as string;
    const [targetTrack, targetStage] = overId.includes('::')
      ? overId.split('::')
      : [stageToTrack[overId] || draggedLead.track, overId];

    // If dropped on another lead card, find which column it belongs to
    if (!overId.includes('::')) {
      // Dropped on a lead — find the lead's stage
      const targetLeadObj = leads.find(l => l.id === overId);
      if (targetLeadObj) {
        if (targetLeadObj.stage === draggedLead.stage && targetLeadObj.track === draggedLead.track) return;
        updateStage.mutate({
          id: draggedLead.id,
          stage: targetLeadObj.stage,
          track: targetLeadObj.track,
        });
        return;
      }
    }

    if (targetStage === draggedLead.stage && targetTrack === draggedLead.track) return;

    updateStage.mutate({
      id: draggedLead.id,
      stage: targetStage,
      track: targetTrack,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {trackConfigs.map(tc => (
          <div key={tc.track}>
            <div className="h-12 rounded bg-brand-surface animate-shimmer mb-3" style={{ backgroundImage: 'linear-gradient(90deg, #F0EFEB 25%, #E8E6E0 50%, #F0EFEB 75%)', backgroundSize: '200% 100%' }} />
            <div className="grid grid-cols-4 gap-3">
              {tc.stages.map(s => (
                <div key={s} className="space-y-2">
                  {[1, 2].map(i => <SkeletonCard key={i} />)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const displayedTracks = activeTrack === 'All' ? trackConfigs : trackConfigs.filter(tc => tc.track === activeTrack);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1">
          {['All', 'Not Ready', 'Franchise Ready', 'Recruitment Only'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTrack(tab)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                activeTrack === tab ? 'text-brand-crimson border-b-2 border-brand-crimson' : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              {tab}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-surface">{trackCounts[tab as keyof typeof trackCounts]}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-32 h-8 text-[12px] border-brand-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="score">Score ↓</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-muted" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-8 h-8 w-40 text-[12px] border-brand-border focus:border-brand-crimson"
            />
          </div>
        </div>
      </div>

      {/* Kanban with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {displayedTracks.map(tc => {
          const colors = getTrackColors(tc.track);
          const isCollapsed = collapsed[tc.track];
          const trackLeadCount = filteredLeads.filter(l => l.track === tc.track).length;

          return (
            <div key={tc.track} className="space-y-3">
              <button
                onClick={() => setCollapsed(prev => ({ ...prev, [tc.track]: !prev[tc.track] }))}
                className="w-full flex items-center justify-between h-12 px-4 rounded-lg"
                style={{ backgroundColor: colors.bg, borderBottom: `2px solid ${colors.border}` }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-semibold" style={{ color: colors.text }}>{tc.track}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/80 font-medium" style={{ color: colors.text }}>
                    {trackLeadCount}
                  </span>
                </div>
                {isCollapsed ? <ChevronDown className="w-4 h-4" style={{ color: colors.text }} /> : <ChevronUp className="w-4 h-4" style={{ color: colors.text }} />}
              </button>

              {!isCollapsed && (
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${tc.stages.length}, minmax(220px, 1fr))` }}>
                  {tc.stages.map(stage => {
                    const stageLeads = getLeadsForStage(tc.track, stage);
                    const droppableId = `${tc.track}::${stage}`;

                    return (
                      <DroppableColumn key={stage} id={droppableId}>
                        <div className="flex items-center justify-between mb-2 px-1">
                          <span className="text-[13px] font-semibold uppercase text-brand-muted">{stage}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-crimson text-white font-semibold">
                            {stageLeads.length}
                          </span>
                        </div>
                        <SortableContext items={stageLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-2">
                            {stageLeads.length === 0 ? (
                              <div className="border border-dashed border-brand-border rounded-lg p-4 text-center">
                                <span className="text-[12px] text-brand-muted">No leads</span>
                              </div>
                            ) : (
                              stageLeads.map(lead => (
                                <SortableLeadCard key={lead.id} lead={lead} onClick={() => openLead(lead)} />
                              ))
                            )}
                          </div>
                        </SortableContext>
                      </DroppableColumn>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <DragOverlay>
          {activeDragLead ? (
            <div className="w-[260px]">
              <LeadCard lead={activeDragLead} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <LeadDrawer leadId={selectedLeadId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
