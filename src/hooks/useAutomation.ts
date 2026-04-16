import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSequences, updateSequence, fetchAutomationLogs } from '@/lib/api';

export function useSequences() {
  return useQuery({ queryKey: ['sequences'], queryFn: fetchSequences });
}

export function useUpdateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateSequence(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequences'] }); },
  });
}

export function useAutomationLogs(params?: { leadId?: string; channel?: string; status?: string; page?: number }) {
  return useQuery({ queryKey: ['automationLogs', params], queryFn: () => fetchAutomationLogs(params) });
}
