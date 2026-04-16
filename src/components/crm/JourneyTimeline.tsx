import { format } from 'date-fns';
import type { JourneyEvent } from '@/types';
import {
  Eye, MousePointerClick, FileInput, MessageCircle, UserPlus,
  BarChart3, GitBranch, Zap, Phone, PhoneOff, FileText, Mail,
  MailOpen, CheckCircle2, StickyNote, Send, ArrowRight
} from 'lucide-react';

const eventConfig: Record<string, { icon: typeof Eye; color: string; bg: string }> = {
  ad_impression: { icon: Eye, color: 'text-blue-600', bg: 'bg-blue-100' },
  ad_click: { icon: MousePointerClick, color: 'text-blue-700', bg: 'bg-blue-100' },
  form_submitted: { icon: FileInput, color: 'text-purple-600', bg: 'bg-purple-100' },
  wa_opened: { icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-100' },
  wa_first_message: { icon: MessageCircle, color: 'text-green-700', bg: 'bg-green-100' },
  wa_agent_reply: { icon: Send, color: 'text-green-600', bg: 'bg-green-50' },
  wa_message_sent: { icon: Send, color: 'text-green-500', bg: 'bg-green-50' },
  wa_message_received: { icon: MessageCircle, color: 'text-green-700', bg: 'bg-green-100' },
  wa_template_sent: { icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-50' },
  lead_created: { icon: UserPlus, color: 'text-brand-crimson', bg: 'bg-red-50' },
  lead_scored: { icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50' },
  track_assigned: { icon: GitBranch, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  stage_changed: { icon: ArrowRight, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  call_booked: { icon: Phone, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  call_completed: { icon: Phone, color: 'text-green-600', bg: 'bg-green-50' },
  call_noshow: { icon: PhoneOff, color: 'text-red-500', bg: 'bg-red-50' },
  proposal_sent: { icon: FileText, color: 'text-brand-crimson', bg: 'bg-red-50' },
  proposal_opened: { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
  proposal_signed: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
  email_sent: { icon: Mail, color: 'text-gray-600', bg: 'bg-gray-100' },
  email_opened: { icon: MailOpen, color: 'text-amber-600', bg: 'bg-amber-50' },
  note_added: { icon: StickyNote, color: 'text-gray-500', bg: 'bg-gray-50' },
  client_signed: { icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-100' },
  sequence_started: { icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50' },
  sequence_step: { icon: Zap, color: 'text-purple-500', bg: 'bg-purple-50' },
};

function getSourceBadge(source?: string) {
  if (!source) return null;
  const colors: Record<string, string> = {
    meta_ads: 'bg-blue-100 text-blue-700',
    whatsapp: 'bg-green-100 text-green-700',
    crm: 'bg-gray-100 text-gray-700',
    automation: 'bg-purple-100 text-purple-700',
    manual: 'bg-amber-100 text-amber-700',
  };
  const labels: Record<string, string> = {
    meta_ads: 'Meta Ads', whatsapp: 'WhatsApp', crm: 'CRM', automation: 'Automation', manual: 'Manual',
  };
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colors[source] || 'bg-gray-100 text-gray-600'}`}>
      {labels[source] || source}
    </span>
  );
}

interface JourneyTimelineProps {
  events: JourneyEvent[];
}

export function JourneyTimeline({ events }: JourneyTimelineProps) {
  if (!events.length) return (
    <div className="text-center py-8 text-brand-muted text-[13px]">No journey data available</div>
  );

  // Group events by date
  const grouped: Record<string, JourneyEvent[]> = {};
  events.forEach(e => {
    const date = format(new Date(e.timestamp), 'yyyy-MM-dd');
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(e);
  });

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([date, dayEvents]) => (
        <div key={date}>
          <div className="sticky top-0 bg-white z-10 pb-2">
            <span className="text-[11px] font-semibold text-brand-muted uppercase tracking-wider">
              {format(new Date(date), 'EEEE, MMM d, yyyy')}
            </span>
          </div>
          <div className="relative ml-4 border-l-2 border-brand-border pl-6 space-y-3">
            {dayEvents.map(event => {
              const config = eventConfig[event.type] || { icon: Eye, color: 'text-gray-500', bg: 'bg-gray-100' };
              const Icon = config.icon;
              return (
                <div key={event.id} className="relative group">
                  {/* Dot on timeline */}
                  <div className={`absolute -left-[31px] top-1 w-5 h-5 rounded-full ${config.bg} flex items-center justify-center ring-2 ring-white`}>
                    <Icon className={`w-3 h-3 ${config.color}`} />
                  </div>

                  <div className="bg-brand-surface/50 rounded-lg p-3 hover:bg-brand-surface transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-semibold text-brand-ink">{event.title}</span>
                          {getSourceBadge(event.source)}
                          {event.channel && (
                            <span className="text-[10px] text-brand-muted capitalize">{event.channel}</span>
                          )}
                        </div>
                        <p className="text-[12px] text-brand-text mt-0.5">{event.description}</p>
                      </div>
                      <span className="text-[11px] text-brand-muted whitespace-nowrap">
                        {format(new Date(event.timestamp), 'h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
