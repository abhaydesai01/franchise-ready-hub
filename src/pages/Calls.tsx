import { useState } from 'react';
import { useCalls } from '@/hooks/useCalls';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScoreBadge } from '@/components/crm/ScoreBadge';
import { TrackPill } from '@/components/crm/TrackPill';
import { SkeletonTable } from '@/components/crm/SkeletonCard';
import { EmptyState } from '@/components/crm/EmptyState';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ExternalLink, Calendar, PhoneCall, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { VoiceCallActivityPanel } from '@/components/crm/VoiceCallActivityPanel';

export default function Calls() {
  const { data: upcomingCalls = [], isLoading: loadingUpcoming } = useCalls({ status: 'upcoming' });
  const { data: completedCalls = [], isLoading: loadingCompleted } = useCalls({ status: 'completed' });
  const { data: noshowCalls = [], isLoading: loadingNoshow } = useCalls({ status: 'noshow' });
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-rose-50 to-white border border-rose-100 rounded-[10px] p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex gap-2.5 min-w-0 items-start">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-brand-crimson/10 flex items-center justify-center">
            <PhoneCall className="w-4 h-4 text-brand-crimson" />
          </div>
          <p className="text-[12px] text-brand-muted max-w-3xl leading-snug">
            <span className="font-semibold text-brand-ink">Calls hub:</span> use <strong>Voice — Optimizer</strong> for all
            outbound attempts, transcripts, and details. <strong>Upcoming / Completed</strong> are scheduled discovery
            meetings. Configure keys in <strong>Settings → Integrations</strong>.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="text-[12px] border-brand-border" onClick={() => navigate('/settings')}>
            Optimizer settings
          </Button>
          <Button className="shrink-0 bg-brand-crimson hover:bg-brand-crimson-dk text-[12px]" onClick={() => navigate('/leads')}>
            Open Leads <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="voice" className="space-y-4">
      <TabsList className="bg-brand-surface border border-brand-border flex-wrap h-auto">
        <TabsTrigger value="voice" className="text-[12px] data-[state=active]:bg-white data-[state=active]:text-brand-crimson">
          Voice — Optimizer
        </TabsTrigger>
        <TabsTrigger value="upcoming" className="text-[12px] data-[state=active]:bg-white data-[state=active]:text-brand-crimson">
          Upcoming ({upcomingCalls.length})
        </TabsTrigger>
        <TabsTrigger value="completed" className="text-[12px] data-[state=active]:bg-white data-[state=active]:text-brand-crimson">
          Completed ({completedCalls.length})
        </TabsTrigger>
        <TabsTrigger value="noshows" className="text-[12px] data-[state=active]:bg-white data-[state=active]:text-brand-crimson">
          No-Shows ({noshowCalls.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="voice" className="mt-0">
        <VoiceCallActivityPanel />
      </TabsContent>

      <TabsContent value="upcoming">
        {loadingUpcoming ? <SkeletonTable rows={3} /> : upcomingCalls.length === 0 ? (
          <EmptyState title="No upcoming calls" description="No discovery calls scheduled" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 bg-white rounded-[10px] border border-brand-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-brand-crimson" />
                <h3 className="text-[15px] font-semibold text-brand-ink">Calendar</h3>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-brand-muted mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                  const dateStr = `2024-12-${String(day).padStart(2, '0')}`;
                  const hasCall = upcomingCalls.some(c => c.scheduledAt.startsWith(dateStr));
                  const isToday = day === new Date().getDate();
                  return (
                    <button key={day} onClick={() => setSelectedDate(dateStr)}
                      className={`w-8 h-8 rounded-full text-[12px] relative ${isToday ? 'bg-brand-crimson text-white' : 'hover:bg-brand-surface'}`}>
                      {day}
                      {hasCall && !isToday && <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-crimson" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="lg:col-span-8 space-y-3">
              {upcomingCalls.map(call => (
                <div key={call.id} className="bg-white rounded-[10px] border border-brand-border p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <button onClick={() => navigate(`/leads/${call.leadId}`)}
                      className="text-[15px] font-semibold text-brand-ink hover:text-brand-crimson">{call.leadName}</button>
                    <div className="flex items-center gap-2 mt-1">
                      <TrackPill track={call.track} />
                      <ScoreBadge score={call.score} />
                    </div>
                  </div>
                  <span className="text-[12px] px-3 py-1 rounded bg-brand-surface text-brand-text">
                    {new Date(call.scheduledAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-[12px] text-brand-muted">{call.consultantName}</span>
                  {call.calcomLink && (
                    <a href={call.calcomLink} target="_blank" rel="noreferrer" className="text-brand-crimson hover:text-brand-crimson-dk">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="completed">
        {loadingCompleted ? <SkeletonTable /> : completedCalls.length === 0 ? (
          <EmptyState title="No completed calls" description="Complete calls will appear here" />
        ) : (
          <div className="bg-white rounded-[10px] border border-brand-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-brand-surface">
                  <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Lead</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Date</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Track</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Score</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Notes</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Proposal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedCalls.map(call => (
                  <TableRow key={call.id} className="hover:bg-brand-surface">
                    <TableCell className="text-[14px] font-semibold text-brand-ink cursor-pointer hover:text-brand-crimson"
                      onClick={() => navigate(`/leads/${call.leadId}`)}>{call.leadName}</TableCell>
                    <TableCell className="text-[12px] text-brand-muted">{new Date(call.scheduledAt).toLocaleDateString()}</TableCell>
                    <TableCell><TrackPill track={call.track} /></TableCell>
                    <TableCell><ScoreBadge score={call.score} /></TableCell>
                    <TableCell className="text-[12px] text-brand-text max-w-[200px] truncate">{call.notes || '—'}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${call.proposalGenerated ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {call.proposalGenerated ? 'Yes' : 'No'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="noshows">
        {loadingNoshow ? <SkeletonTable /> : noshowCalls.length === 0 ? (
          <EmptyState title="No no-shows" description="Great! Everyone showed up" />
        ) : (
          <div className="bg-white rounded-[10px] border border-brand-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-brand-surface">
                  <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Lead</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Scheduled</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Track</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Follow-up Sent</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase text-brand-muted">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {noshowCalls.map(call => (
                  <TableRow key={call.id} className="hover:bg-brand-surface">
                    <TableCell className="text-[14px] font-semibold text-brand-ink">{call.leadName}</TableCell>
                    <TableCell className="text-[12px] text-brand-muted">{new Date(call.scheduledAt).toLocaleDateString()}</TableCell>
                    <TableCell><TrackPill track={call.track} /></TableCell>
                    <TableCell>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${call.followUpSent ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {call.followUpSent ? 'Yes' : 'No'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" className="text-[11px] border-brand-border gap-1 h-7">
                        Reschedule →
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>
    </Tabs>
    </div>
  );
}
