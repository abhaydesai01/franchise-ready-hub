import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCalls, fetchVoiceCallActivity, updateCall } from '@/lib/api';

export function useCalls(params?: { status?: string; date?: string }) {
  return useQuery({ queryKey: ['calls', params], queryFn: () => fetchCalls(params) });
}

export function useVoiceCallActivity(params: {
  page: number;
  limit?: number;
  search: string;
}) {
  return useQuery({
    queryKey: ['voiceCallActivity', params.page, params.limit ?? 20, params.search],
    queryFn: () =>
      fetchVoiceCallActivity({
        page: params.page,
        limit: params.limit ?? 20,
        search: params.search || undefined,
      }),
  });
}

export function useUpdateCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateCall(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calls'] }); },
  });
}
