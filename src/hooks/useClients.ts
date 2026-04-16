import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchClients, updateClient } from '@/lib/api';

export function useClients() {
  return useQuery({ queryKey: ['clients'], queryFn: fetchClients });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateClient(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); },
  });
}
