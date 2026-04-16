import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCalls, updateCall } from '@/lib/api';

export function useCalls(params?: { status?: string; date?: string }) {
  return useQuery({ queryKey: ['calls', params], queryFn: () => fetchCalls(params) });
}

export function useUpdateCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateCall(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calls'] }); },
  });
}
