import {
  useLead,
  useLeadActivity,
  useAddLeadNote,
  useLeadJourney,
  useLeadConversation,
} from '@/hooks/useLeads';
import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Phone, FileText, ChevronDown, MessageCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScoreBadge } from '@/components/crm/ScoreBadge';
import { TrackPill } from '@/components/crm/TrackPill';
import { StagePill } from '@/components/crm/StagePill';
import { ActivityFeed } from '@/components/crm/ActivityFeed';
import { JourneyTimeline } from '@/components/crm/JourneyTimeline';
import { WhatsAppChat } from '@/components/crm/WhatsAppChat';
import { CampaignCard } from '@/components/crm/CampaignCard';
import { SkeletonCard } from '@/components/crm/SkeletonCard';
import { LeadVoiceCallsPanel } from '@/components/crm/LeadVoiceCallsPanel';
import { DispatchVaaniCallButton } from '@/components/crm/DispatchVaaniCallButton';
import { toast } from 'sonner';

export default function LeadProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(id || '');
  const { data: activities = [] } = useLeadActivity(id || '');
  const { data: journeyEvents = [] } = useLeadJourney(id || '');
  const { data: conversation } = useLeadConversation(id || '');
  const addNote = useAddLeadNote();
  const [noteText, setNoteText] = useState('');
  const campaign = lead?.campaign;

  if (isLoading) return <div className="max-w-5xl mx-auto space-y-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
  if (!lead) return <div className="text-center py-16 text-brand-muted">Lead not found</div>;

  const defaultActivityTab =
    (lead.voiceCalls?.length ?? 0) > 0
      ? 'voice'
      : journeyEvents.length > 0
        ? 'journey'
        : 'activity';

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await addNote.mutateAsync({ leadId: lead.id, text: noteText, addedBy: 't1' });
    setNoteText('');
    toast.success('Note added');
  };

  return (
    <div className="max-w-5xl mx-auto">
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
            <div className="flex gap-2 mt-1 flex-wrap">
              <TrackPill track={lead.track} />
              <StagePill stage={lead.stage} />
              {lead.source === 'Meta Ad' && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Meta Ad</span>
              )}
              {lead.source === 'WhatsApp Inbound' && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">WhatsApp</span>
              )}
            </div>
          </div>
          <ScoreBadge score={lead.score} size="md" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="text-[12px] border-brand-border gap-1.5">
            <Phone className="w-3.5 h-3.5" /> Book Call
          </Button>
          <DispatchVaaniCallButton leadId={lead.id} />
          <Button
            variant="outline"
            size="sm"
            className="text-[12px] border-brand-border gap-1.5"
            onClick={() => navigate('/settings')}
          >
            <Settings className="w-3.5 h-3.5" /> Optimizer settings
          </Button>
          <Button size="sm" className="text-[12px] bg-brand-crimson hover:bg-brand-crimson-dk text-white gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Send Proposal
          </Button>
          <Button variant="outline" size="sm" className="text-[12px] border-brand-border gap-1.5">
            Move Stage <ChevronDown className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column — 2/5 */}
        <div className="lg:col-span-2 space-y-6">
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
              {lead.company && (
                <div className="flex justify-between">
                  <span className="text-[13px] text-brand-muted">Company</span>
                  <span className="text-[13px]">{lead.company}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[13px] text-brand-muted">Source</span>
                <span className="text-[12px] px-2 py-0.5 rounded-full bg-brand-surface">{lead.source}</span>
              </div>
              {(lead.metaLeadId || lead.metaFormId || lead.utmSource || lead.utmMedium || lead.utmCampaign) && (
                <>
                  <div className="pt-2 border-t border-brand-border" />
                  {lead.metaLeadId && (
                    <div className="flex justify-between gap-3">
                      <span className="text-[13px] text-brand-muted">Meta Lead ID</span>
                      <span className="text-[12px] font-mono text-right break-all">{lead.metaLeadId}</span>
                    </div>
                  )}
                  {lead.metaFormId && (
                    <div className="flex justify-between gap-3">
                      <span className="text-[13px] text-brand-muted">Meta Form ID</span>
                      <span className="text-[12px] font-mono text-right break-all">{lead.metaFormId}</span>
                    </div>
                  )}
                  {lead.utmSource && (
                    <div className="flex justify-between gap-3">
                      <span className="text-[13px] text-brand-muted">UTM Source</span>
                      <span className="text-[13px] text-right">{lead.utmSource}</span>
                    </div>
                  )}
                  {lead.utmMedium && (
                    <div className="flex justify-between gap-3">
                      <span className="text-[13px] text-brand-muted">UTM Medium</span>
                      <span className="text-[13px] text-right">{lead.utmMedium}</span>
                    </div>
                  )}
                  {lead.utmCampaign && (
                    <div className="flex justify-between gap-3">
                      <span className="text-[13px] text-brand-muted">UTM Campaign</span>
                      <span className="text-[13px] text-right">{lead.utmCampaign}</span>
                    </div>
                  )}
                </>
              )}
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

          {/* Campaign Attribution */}
          {campaign && <CampaignCard campaign={campaign} />}
        </div>

        {/* Right Column — 3/5 */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-[10px] border border-brand-border p-6">
            <Tabs key={`${lead.id}-tabs`} defaultValue={defaultActivityTab}>
              <TabsList className="bg-brand-surface mb-4 flex-wrap h-auto gap-1">
                {journeyEvents.length > 0 && (
                  <TabsTrigger value="journey" className="text-[12px]">
                    Journey ({journeyEvents.length})
                  </TabsTrigger>
                )}
                <TabsTrigger value="activity" className="text-[12px]">
                  Activity ({activities.length})
                </TabsTrigger>
                {conversation && (
                  <TabsTrigger value="whatsapp" className="text-[12px]">
                    WhatsApp ({conversation.totalMessages})
                  </TabsTrigger>
                )}
                <TabsTrigger value="voice" className="text-[12px]">
                  Voice ({lead.voiceCalls?.length ?? 0})
                </TabsTrigger>
              </TabsList>

              {journeyEvents.length > 0 && (
                <TabsContent value="journey" className="mt-0">
                  <JourneyTimeline events={journeyEvents} />
                </TabsContent>
              )}

              <TabsContent value="activity" className="mt-0">
                <div className="flex gap-2 mb-4">
                  <Textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                    placeholder="Log a note..." className="text-[13px] border-brand-border min-h-[60px]" rows={2} />
                  <Button onClick={handleAddNote} disabled={!noteText.trim()}
                    className="bg-brand-crimson hover:bg-brand-crimson-dk text-white text-[12px] px-3 self-end">
                    Log
                  </Button>
                </div>
                <ActivityFeed activities={activities} />
              </TabsContent>

              {conversation && (
                <TabsContent value="whatsapp" className="mt-0">
                  <WhatsAppChat conversation={conversation} />
                </TabsContent>
              )}

              <TabsContent value="voice" className="mt-0">
                <LeadVoiceCallsPanel lead={lead} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
