import { useState } from 'react';
import { X, Phone, FileText, ChevronDown, MessageCircle } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScoreBadge } from './ScoreBadge';
import { TrackPill } from './TrackPill';
import { StagePill } from './StagePill';
import { ActivityFeed } from './ActivityFeed';
import { JourneyTimeline } from './JourneyTimeline';
import { WhatsAppChat } from './WhatsAppChat';
import { CampaignCard } from './CampaignCard';
import { useLead, useLeadActivity, useAddLeadNote } from '@/hooks/useLeads';
import { getLeadJourney, getLeadConversation, getLeadCampaign } from '@/lib/journeyMockData';
import { toast } from 'sonner';

interface LeadDrawerProps {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadDrawer({ leadId, open, onOpenChange }: LeadDrawerProps) {
  const { data: lead } = useLead(leadId || '');
  const { data: activities = [] } = useLeadActivity(leadId || '');
  const addNote = useAddLeadNote();
  const [noteText, setNoteText] = useState('');

  const journeyEvents = leadId ? getLeadJourney(leadId) : [];
  const conversation = leadId ? getLeadConversation(leadId) : undefined;
  const campaign = leadId ? getLeadCampaign(leadId) : undefined;

  if (!lead) return null;

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await addNote.mutateAsync({ leadId: lead.id, text: noteText, addedBy: 't1' });
    setNoteText('');
    toast.success('Note added');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[580px] bg-white border-brand-border p-0 overflow-y-auto" side="right">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-brand-border px-6 py-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-[20px] font-bold text-brand-ink">{lead.name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
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
            <button onClick={() => onOpenChange(false)} className="p-1 hover:bg-brand-surface rounded">
              <X className="w-5 h-5 text-brand-muted" />
            </button>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Body */}
        <div className="px-6 py-4 space-y-6">
          {/* Contact Info */}
          <div className="bg-white rounded-[10px] border border-brand-border p-6">
            <h3 className="text-[15px] font-semibold text-brand-ink mb-4">Contact info</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[13px] text-brand-muted">Phone</span>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-brand-text">{lead.phone}</span>
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
                <span className="text-[12px] px-2 py-0.5 rounded-full bg-brand-surface text-brand-text">{lead.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-brand-muted">Added</span>
                <span className="text-[13px] text-brand-text">{lead.createdAt}</span>
              </div>
            </div>
          </div>

          {/* Score Card */}
          <div className="bg-white rounded-[10px] border border-brand-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-brand-ink">Franchise score</h3>
              <ScoreBadge score={lead.score} size="md" />
            </div>
            <div className="space-y-3">
              {lead.scoreDimensions.map(dim => (
                <div key={dim.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[13px] font-semibold text-brand-ink">{dim.name}</span>
                    <span className="text-[12px] text-brand-muted">{dim.score} / {dim.max}</span>
                  </div>
                  <div className="h-1.5 bg-brand-surface rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(dim.score / dim.max) * 100}%`,
                        backgroundColor: dim.score / dim.max >= 0.7 ? '#1B8A4A' : dim.score / dim.max >= 0.4 ? '#D4882A' : '#C8102E',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Campaign Attribution */}
          {campaign && <CampaignCard campaign={campaign} />}

          {/* Tabbed content: Journey / Activity / WhatsApp */}
          <div className="bg-white rounded-[10px] border border-brand-border p-6">
            <Tabs defaultValue={journeyEvents.length > 0 ? 'journey' : 'activity'}>
              <TabsList className="bg-brand-surface mb-4">
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
              </TabsList>

              {journeyEvents.length > 0 && (
                <TabsContent value="journey" className="mt-0">
                  <JourneyTimeline events={journeyEvents} />
                </TabsContent>
              )}

              <TabsContent value="activity" className="mt-0">
                <div className="flex gap-2 mb-4">
                  <Textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Log a note..."
                    className="text-[13px] border-brand-border focus:border-brand-crimson min-h-[60px]"
                    rows={2}
                  />
                  <Button onClick={handleAddNote} disabled={!noteText.trim() || addNote.isPending}
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
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
