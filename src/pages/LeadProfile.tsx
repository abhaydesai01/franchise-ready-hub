import { useLead, useLeadActivity, useAddLeadNote } from '@/hooks/useLeads';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Phone, FileText, ChevronDown, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScoreBadge } from '@/components/crm/ScoreBadge';
import { TrackPill } from '@/components/crm/TrackPill';
import { StagePill } from '@/components/crm/StagePill';
import { ActivityFeed } from '@/components/crm/ActivityFeed';
import { SkeletonCard } from '@/components/crm/SkeletonCard';
import { toast } from 'sonner';

export default function LeadProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(id || '');
  const { data: activities = [] } = useLeadActivity(id || '');
  const addNote = useAddLeadNote();
  const [noteText, setNoteText] = useState('');

  if (isLoading) return <div className="max-w-4xl mx-auto space-y-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
  if (!lead) return <div className="text-center py-16 text-brand-muted">Lead not found</div>;

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await addNote.mutateAsync({ leadId: lead.id, text: noteText, addedBy: 't1' });
    setNoteText('');
    toast.success('Note added');
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>
      <div className="bg-white rounded-[10px] border border-brand-border p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)] mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-bold text-brand-ink">{lead.name}</h1>
            <div className="flex gap-2 mt-1">
              <TrackPill track={lead.track} />
              <StagePill stage={lead.stage} />
            </div>
          </div>
          <ScoreBadge score={lead.score} size="md" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-[12px] border-brand-border gap-1.5">
            <Phone className="w-3.5 h-3.5" /> Book Call
          </Button>
          <Button size="sm" className="text-[12px] bg-brand-crimson hover:bg-brand-crimson-dk text-white gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Send Proposal
          </Button>
          <Button variant="outline" size="sm" className="text-[12px] border-brand-border gap-1.5">
            Move Stage <ChevronDown className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Contact */}
          <div className="bg-white rounded-[10px] border border-brand-border p-6">
            <h3 className="text-[15px] font-semibold text-brand-ink mb-4">Contact info</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[13px] text-brand-muted">Phone</span>
                <div className="flex items-center gap-2">
                  <span className="text-[13px]">{lead.phone}</span>
                  <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                    <MessageCircle className="w-4 h-4 text-green-600" />
                  </a>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-brand-muted">Email</span>
                <a href={`mailto:${lead.email}`} className="text-[13px] text-brand-crimson hover:underline">{lead.email}</a>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-brand-muted">Source</span>
                <span className="text-[12px] px-2 py-0.5 rounded-full bg-brand-surface">{lead.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-brand-muted">Added</span>
                <span className="text-[13px]">{lead.createdAt}</span>
              </div>
            </div>
          </div>

          {/* Score */}
          <div className="bg-white rounded-[10px] border border-brand-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-brand-ink">Franchise score</h3>
              <span className="text-[20px] font-bold text-brand-crimson">{lead.score} / 100</span>
            </div>
            <div className="space-y-3">
              {lead.scoreDimensions.map(dim => (
                <div key={dim.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[13px] font-semibold text-brand-ink">{dim.name}</span>
                    <span className="text-[12px] text-brand-muted">{dim.score} / {dim.max}</span>
                  </div>
                  <div className="h-1.5 bg-brand-surface rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${(dim.score / dim.max) * 100}%`,
                      backgroundColor: dim.score / dim.max >= 0.7 ? '#1B8A4A' : dim.score / dim.max >= 0.4 ? '#D4882A' : '#C8102E',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="bg-white rounded-[10px] border border-brand-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-brand-ink">Activity</h3>
              <span className="text-[12px] px-2 py-0.5 rounded-full bg-brand-surface text-brand-muted">{activities.length}</span>
            </div>
            <div className="flex gap-2 mb-4">
              <Textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                placeholder="Log a note..." className="text-[13px] border-brand-border min-h-[60px]" rows={2} />
              <Button onClick={handleAddNote} disabled={!noteText.trim()}
                className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[12px] px-3 self-end">
                Log
              </Button>
            </div>
            <ActivityFeed activities={activities} />
          </div>
        </div>
      </div>
    </div>
  );
}
