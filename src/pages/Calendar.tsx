import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays, ChevronLeft, ChevronRight, Video,
  User, Search, CheckCircle2, AlertCircle, Plus, Clock, Trash2, Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  useCalendarIntegrationStatus, useCalendarAvailableSlots,
  useBookCalendarSlot, useCalendarEvents, useCreateCalendarEvent,
  useRescheduleCalendarEvent, useDeleteCalendarEvent,
} from '@/hooks/useSettings';
import { fetchLeads } from '@/lib/api';
import type { CalendarTestSlot, Lead } from '@/types';
import type { CalendarEvent } from '@/lib/api';
import { toast } from 'sonner';

/* ── helpers ── */

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function formatHM(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type DayCell = { date: Date; inMonth: boolean };

function buildGrid(month: Date): DayCell[] {
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const cells: DayCell[] = [];
  for (let i = 0; i < first.getDay(); i++) {
    const d = new Date(first);
    d.setDate(d.getDate() - (first.getDay() - i));
    cells.push({ date: d, inMonth: false });
  }
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push({ date: new Date(month.getFullYear(), month.getMonth(), d), inMonth: true });
  }
  while (cells.length < 42) {
    const prev = cells[cells.length - 1].date;
    const next = new Date(prev);
    next.setDate(next.getDate() + 1);
    cells.push({ date: next, inMonth: false });
  }
  return cells;
}

function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => isSameDay(new Date(e.start), day));
}

/* ── component ── */

export default function Calendar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: integrationStatus } = useCalendarIntegrationStatus();
  const isConnected = integrationStatus?.google?.connected ?? false;

  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Unified schedule dialog state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState<Pick<Lead, 'id' | 'name' | 'email' | 'phone'> | null>(null);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('09:00');
  const [schedDuration, setSchedDuration] = useState('30');
  const [schedCreateMeet, setSchedCreateMeet] = useState(true);

  // Reschedule dialog state
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleEvent, setRescheduleEventState] = useState<CalendarEvent | null>(null);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedTime, setReschedTime] = useState('');
  const [reschedDuration, setReschedDuration] = useState('30');

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteEvent, setDeleteEventState] = useState<CalendarEvent | null>(null);

  const gridStart = useMemo(() => {
    const first = startOfMonth(currentMonth);
    const d = new Date(first);
    d.setDate(d.getDate() - first.getDay());
    return d;
  }, [currentMonth]);
  const gridEnd = useMemo(() => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + 42);
    return d;
  }, [gridStart]);

  const { data: events = [], isLoading: loadingEvents } = useCalendarEvents(
    gridStart.toISOString(), gridEnd.toISOString(), isConnected,
  );

  const { data: allSlots = [] } = useCalendarAvailableSlots(isConnected);
  const bookMutation = useBookCalendarSlot();
  const createEventMutation = useCreateCalendarEvent();
  const rescheduleMutation = useRescheduleCalendarEvent();
  const deleteMutation = useDeleteCalendarEvent();

  const { data: leadsResult } = useQuery({
    queryKey: ['leads-search', leadSearch],
    queryFn: () => fetchLeads({ search: leadSearch, limit: 10 }),
    enabled: leadSearch.length >= 2,
  });

  const grid = useMemo(() => buildGrid(currentMonth), [currentMonth]);
  const dayEvents = useMemo(() => eventsForDay(events, selectedDate), [events, selectedDate]);
  const daySlots = useMemo(
    () => allSlots.filter((s) => isSameDay(new Date(s.startTime), selectedDate)),
    [allSlots, selectedDate],
  );

  function prevMonth() { setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  function nextMonth() { setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }
  function goToday() {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  }

  function openScheduleDialog(slot?: CalendarTestSlot) {
    const dateStr = slot
      ? new Date(slot.startTime).toISOString().slice(0, 10)
      : selectedDate.toISOString().slice(0, 10);
    const timeStr = slot
      ? new Date(slot.startTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '09:00';
    setSchedDate(dateStr);
    setSchedTime(timeStr);
    setSchedDuration('30');
    setSchedCreateMeet(true);
    setLeadSearch('');
    setSelectedLead(null);
    setScheduleDialogOpen(true);
  }

  async function handleSchedule() {
    if (!selectedLead) return;
    const startDate = new Date(`${schedDate}T${schedTime}:00`);
    const endDate = new Date(startDate.getTime() + parseInt(schedDuration, 10) * 60 * 1000);
    const title = `Discovery Call — ${selectedLead.name}`;
    try {
      const result = await createEventMutation.mutateAsync({
        title,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        attendeeEmail: selectedLead.email || undefined,
        createMeet: schedCreateMeet,
      });
      const desc = result.meetLink ? 'Meet link created' : 'Event created';
      toast.success('Event scheduled!', { description: desc });
      setScheduleDialogOpen(false);
    } catch (e: any) {
      toast.error('Failed to schedule', { description: e.message ?? 'Please try again' });
    }
  }

  function openRescheduleDialog(ev: CalendarEvent) {
    setRescheduleEventState(ev);
    const start = new Date(ev.start);
    setReschedDate(start.toISOString().slice(0, 10));
    setReschedTime(start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }));
    const durMin = Math.round((new Date(ev.end).getTime() - start.getTime()) / 60000);
    setReschedDuration(String(durMin || 30));
    setRescheduleDialogOpen(true);
  }

  async function handleReschedule() {
    if (!rescheduleEvent) return;
    const startDate = new Date(`${reschedDate}T${reschedTime}:00`);
    const endDate = new Date(startDate.getTime() + parseInt(reschedDuration, 10) * 60 * 1000);
    try {
      await rescheduleMutation.mutateAsync({
        eventId: rescheduleEvent.id,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
      });
      toast.success('Event rescheduled!');
      setRescheduleDialogOpen(false);
      setRescheduleEventState(null);
    } catch (e: any) {
      toast.error('Reschedule failed', { description: e.message ?? 'Please try again' });
    }
  }

  function openDeleteDialog(ev: CalendarEvent) {
    setDeleteEventState(ev);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteEvent) return;
    try {
      await deleteMutation.mutateAsync(deleteEvent.id);
      toast.success('Event deleted');
      setDeleteDialogOpen(false);
      setDeleteEventState(null);
    } catch (e: any) {
      toast.error('Delete failed', { description: e.message ?? 'Please try again' });
    }
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-brand-muted" />
        <h2 className="text-lg font-semibold text-brand-ink">Google Calendar not connected</h2>
        <p className="text-sm text-brand-muted">Connect your Google Calendar in Settings to view your schedule.</p>
        <Button onClick={() => navigate('/settings?tab=calendar')} className="bg-brand-crimson hover:bg-brand-crimson-dk text-white">
          Go to Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-120px)]">
      {/* ── Left: Monthly Calendar ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-[17px] font-semibold text-brand-ink min-w-[180px] text-center">
              {monthLabel(currentMonth)}
            </h2>
            <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToday} className="text-xs ml-1">Today</Button>
          </div>
          <div className="flex items-center gap-2">
            {loadingEvents && <span className="text-xs text-brand-muted animate-pulse">Loading…</span>}
            <Button size="sm" onClick={() => openScheduleDialog()} className="bg-brand-crimson hover:bg-brand-crimson-dk text-white">
              <Plus className="w-3.5 h-3.5 mr-1" /> Schedule Event
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-brand-border">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-[11px] font-semibold text-brand-muted py-1.5 uppercase tracking-wide">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 flex-1 border-l border-brand-border">
          {grid.map((cell, i) => {
            const isToday = isSameDay(cell.date, today);
            const isSelected = isSameDay(cell.date, selectedDate);
            const cellEvents = eventsForDay(events, cell.date);
            const hasSlots = allSlots.some((s) => isSameDay(new Date(s.startTime), cell.date));
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(cell.date)}
                className={`
                  relative border-r border-b border-brand-border p-1 text-left transition-colors
                  hover:bg-brand-surface/60 flex flex-col min-h-[80px]
                  ${!cell.inMonth ? 'bg-gray-50/60' : 'bg-white'}
                  ${isSelected ? 'ring-2 ring-inset ring-brand-crimson' : ''}
                `}
              >
                <span className={`
                  text-[12px] font-medium w-6 h-6 flex items-center justify-center rounded-full
                  ${isToday ? 'bg-brand-crimson text-white' : cell.inMonth ? 'text-brand-ink' : 'text-brand-muted/40'}
                `}>
                  {cell.date.getDate()}
                </span>
                <div className="flex flex-col gap-0.5 mt-0.5 overflow-hidden flex-1">
                  {cellEvents.slice(0, 3).map((ev) => (
                    <div key={ev.id} className="text-[10px] leading-tight truncate rounded px-1 py-[1px] bg-blue-100 text-blue-800" title={ev.summary}>
                      {!ev.allDay && <span className="font-medium">{formatHM(ev.start)} </span>}
                      {ev.summary}
                    </div>
                  ))}
                  {cellEvents.length > 3 && (
                    <span className="text-[9px] text-brand-muted px-1">+{cellEvents.length - 3} more</span>
                  )}
                </div>
                {hasSlots && cell.inMonth && (
                  <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-green-500" title="Slots available" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: Day Detail Panel ── */}
      <div className="w-full lg:w-[340px] flex-shrink-0 border border-brand-border rounded-xl bg-white overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 px-4 py-3 border-b border-brand-border flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-brand-ink">
            {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          <Button variant="outline" size="sm" onClick={() => openScheduleDialog()} className="text-xs">
            <Plus className="w-3 h-3 mr-1" /> New
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {dayEvents.length > 0 && (
            <div>
              <h4 className="text-[11px] uppercase tracking-wide font-semibold text-brand-muted mb-2">
                Events ({dayEvents.length})
              </h4>
              <div className="space-y-2">
                {dayEvents.map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-brand-border p-3 bg-brand-surface/30">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-brand-ink truncate">{ev.summary}</p>
                        <p className="text-[11px] text-brand-muted mt-0.5">
                          {ev.allDay ? 'All day' : `${formatHM(ev.start)} – ${formatHM(ev.end)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openRescheduleDialog(ev)}
                          className="p-1 rounded hover:bg-brand-surface transition-colors" title="Reschedule">
                          <Pencil className="w-3.5 h-3.5 text-brand-muted hover:text-brand-ink" />
                        </button>
                        <button onClick={() => openDeleteDialog(ev)}
                          className="p-1 rounded hover:bg-red-50 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5 text-brand-muted hover:text-red-600" />
                        </button>
                      </div>
                    </div>
                    {ev.meetLink && (
                      <a href={ev.meetLink} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-brand-crimson hover:underline mt-1">
                        <Video className="w-3 h-3" /> Join Meet
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {dayEvents.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-brand-muted">No events</p>
            </div>
          )}

          {daySlots.length > 0 && (
            <div>
              <h4 className="text-[11px] uppercase tracking-wide font-semibold text-brand-muted mb-2">
                Book a Slot ({daySlots.length})
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {daySlots.map((slot) => (
                  <button key={slot.index} onClick={() => openScheduleDialog(slot)}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 transition-colors text-left group">
                    <Plus className="w-3 h-3 text-green-600 flex-shrink-0" />
                    <div>
                      <span className="text-[12px] font-medium text-green-800 group-hover:text-green-900">{formatHM(slot.startTime)}</span>
                      <span className="text-[10px] text-green-600 block leading-tight">{formatHM(slot.endTime)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Schedule Event Dialog (Lead-based) ── */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-brand-crimson" />
              Schedule Event
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Lead Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-brand-ink">Select Lead</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-brand-muted" />
                <Input placeholder="Search leads by name..." className="pl-9" value={leadSearch}
                  onChange={(e) => { setLeadSearch(e.target.value); setSelectedLead(null); }} />
              </div>
              {selectedLead ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900">{selectedLead.name}</p>
                    <p className="text-xs text-green-700">{selectedLead.email || selectedLead.phone || '—'}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedLead(null)} className="text-xs">Change</Button>
                </div>
              ) : leadsResult?.leads && leadsResult.leads.length > 0 ? (
                <div className="border border-brand-border rounded-lg max-h-48 overflow-y-auto divide-y">
                  {leadsResult.leads.map((lead) => (
                    <button key={lead.id}
                      onClick={() => setSelectedLead({ id: lead.id, name: lead.name, email: lead.email, phone: lead.phone })}
                      className="w-full text-left px-3 py-2.5 hover:bg-brand-surface transition-colors flex items-center gap-2">
                      <User className="w-4 h-4 text-brand-muted" />
                      <div>
                        <p className="text-sm font-medium text-brand-ink">{lead.name}</p>
                        <p className="text-xs text-brand-muted">{lead.email || lead.phone || '—'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : leadSearch.length >= 2 ? (
                <p className="text-xs text-brand-muted py-2">No leads found for "{leadSearch}"</p>
              ) : (
                <p className="text-xs text-brand-muted py-2">Type at least 2 characters to search</p>
              )}
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sched-date">Date</Label>
                <Input id="sched-date" type="date" value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sched-time">Time</Label>
                <Input id="sched-time" type="time" value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)} />
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={schedDuration} onValueChange={setSchedDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="180">3 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Google Meet toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={schedCreateMeet} onChange={(e) => setSchedCreateMeet(e.target.checked)}
                className="rounded border-brand-border" />
              <span className="text-sm text-brand-ink">Create Google Meet link</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSchedule}
              disabled={!selectedLead || !schedDate || !schedTime || createEventMutation.isPending}
              className="bg-brand-crimson hover:bg-brand-crimson-dk text-white">
              {createEventMutation.isPending ? 'Scheduling…' : 'Schedule Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reschedule Dialog ── */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-brand-crimson" />
              Reschedule Event
            </DialogTitle>
          </DialogHeader>
          {rescheduleEvent && (
            <div className="space-y-4">
              <div className="bg-brand-surface rounded-lg p-3 border border-brand-border">
                <p className="text-sm font-medium text-brand-ink truncate">{rescheduleEvent.summary}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={reschedDate} onChange={(e) => setReschedDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Time</Label>
                  <Input type="time" value={reschedTime} onChange={(e) => setReschedTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <Select value={reschedDuration} onValueChange={setReschedDuration}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleReschedule} disabled={rescheduleMutation.isPending}
              className="bg-brand-crimson hover:bg-brand-crimson-dk text-white">
              {rescheduleMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Event
            </DialogTitle>
          </DialogHeader>
          {deleteEvent && (
            <div className="space-y-3">
              <p className="text-sm text-brand-ink">
                Are you sure you want to delete <span className="font-semibold">{deleteEvent.summary}</span>?
              </p>
              <p className="text-xs text-brand-muted">This will remove the event from Google Calendar. This action cannot be undone.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDelete} disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white">
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
