import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTeam, inviteTeamMember, removeTeamMember, fetchSettings, updateSettings } from '@/lib/api';

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
