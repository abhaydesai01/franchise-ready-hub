import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTeam,
  inviteTeamMember,
  removeTeamMember,
  fetchSettings,
  updateSettings,
  updateIntegrationSetting,
  testIntegrationSetting,
  testCalendlyWebhook,
  patchAvailability,
  fetchCalendarIntegrationStatus,
  fetchCalendarTestSlots,
  fetchCalendarUpcoming,
  fetchCalendarAvailableSlots,
  bookCalendarSlot,
  fetchCalendarEvents,
  createCalendarEvent,
  rescheduleCalendarEvent,
  deleteCalendarEvent,
  disconnectGoogleCalendar,
  disconnectOutlookCalendar,
} from '@/lib/api';

export function useTeam() {
  return useQuery({ queryKey: ['team'], queryFn: fetchTeam });
}

export function useInviteTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; role: string }) => inviteTeamMember(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); },
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeTeamMember(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); },
  });
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => updateSettings(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); },
  });
}

export function useUpdateIntegrationSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { apiKey?: string; connected?: boolean } }) =>
      updateIntegrationSetting(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useTestIntegrationSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => testIntegrationSetting(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useTestCalendlyWebhook() {
  return useMutation({
    mutationFn: (signingKey?: string) => testCalendlyWebhook(signingKey),
  });
}

export function useCalendarIntegrationStatus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['calendar-integration'],
    queryFn: fetchCalendarIntegrationStatus,
    enabled: options?.enabled ?? true,
  });
}

export function usePatchAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof patchAvailability>[0]) =>
      patchAvailability(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['calendar-upcoming'] });
      qc.invalidateQueries({ queryKey: ['calendar-integration'] });
    },
  });
}

export function useCalendarUpcoming(enabled: boolean) {
  return useQuery({
    queryKey: ['calendar-upcoming'],
    queryFn: fetchCalendarUpcoming,
    enabled,
  });
}

export function useCalendarTestSlots() {
  return useMutation({
    mutationFn: () => fetchCalendarTestSlots(),
  });
}

export function useDisconnectGoogleCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => disconnectGoogleCalendar(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-integration'] });
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useDisconnectOutlookCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => disconnectOutlookCalendar(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-integration'] });
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useCalendarAvailableSlots(enabled: boolean) {
  return useQuery({
    queryKey: ['calendar-available-slots'],
    queryFn: () => fetchCalendarAvailableSlots(500),
    enabled,
    refetchInterval: 3 * 60 * 1000, // refresh every 3 min
  });
}

export function useBookCalendarSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { leadId: string; startTime: string; endTime: string }) =>
      bookCalendarSlot(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-available-slots'] });
      qc.invalidateQueries({ queryKey: ['calendar-upcoming'] });
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useCalendarEvents(timeMin: string, timeMax: string, enabled: boolean) {
  return useQuery({
    queryKey: ['calendar-events', timeMin, timeMax],
    queryFn: () => fetchCalendarEvents(timeMin, timeMax),
    enabled,
  });
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCalendarEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
      qc.invalidateQueries({ queryKey: ['calendar-available-slots'] });
    },
  });
}

export function useRescheduleCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { eventId: string; startTime: string; endTime: string }) =>
      rescheduleCalendarEvent(data.eventId, { startTime: data.startTime, endTime: data.endTime }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
      qc.invalidateQueries({ queryKey: ['calendar-available-slots'] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => deleteCalendarEvent(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
      qc.invalidateQueries({ queryKey: ['calendar-available-slots'] });
    },
  });
}
