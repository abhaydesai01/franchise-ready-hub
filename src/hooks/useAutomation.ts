import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSequences,
  updateSequence,
  fetchAutomationLogs,
  fetchReEngagementRules,
  fetchReEngagementLogs,
  updateReEngagementRule,
} from '@/lib/api';

export function useSequences() {
  return useQuery({ queryKey: ['sequences'], queryFn: fetchSequences });
}

export function useUpdateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateSequence>[1] }) =>
      updateSequence(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sequences'] });
    },
  });
}

export function useAutomationLogs(params?: {
  leadId?: string;
  channel?: string;
  status?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: ['automationLogs', params],
    queryFn: () => fetchAutomationLogs(params),
  });
}

export function useReEngagementRules() {
  return useQuery({ queryKey: ['reEngagementRules'], queryFn: fetchReEngagementRules });
}

export function useReEngagementLogs() {
  return useQuery({ queryKey: ['reEngagementLogs'], queryFn: fetchReEngagementLogs });
}

export function useUpdateReEngagementRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateReEngagementRule(id, enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reEngagementRules'] });
    },
  });
}
