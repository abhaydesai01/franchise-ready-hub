import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dismissAlert, fetchAlertCounts, fetchAlerts, runAlertAction } from '@/lib/api';
import type { AlertPriority } from '@/types/sales';

export function useAlerts(params?: { priority?: 'all' | AlertPriority }) {
  return useQuery({
    queryKey: ['alerts', params?.priority ?? 'all'],
    queryFn: () => fetchAlerts({ priority: params?.priority ?? 'all' }),
  });
}

export function useAlertCounts() {
  return useQuery({ queryKey: ['alerts', 'counts'], queryFn: fetchAlertCounts });
}

export function useDismissAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dismissAlert(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

export function useRunAlertAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => runAlertAction(id, note),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['alerts'] });
      await qc.invalidateQueries({ queryKey: ['calls'] });
      await qc.invalidateQueries({ queryKey: ['proposals'] });
      await qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}
