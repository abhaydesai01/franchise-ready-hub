import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProposals, generateProposal, updateProposalStatus } from '@/lib/api';

export function useProposals(params?: { status?: string; leadId?: string }) {
  return useQuery({ queryKey: ['proposals', params], queryFn: () => fetchProposals(params) });
}

export function useGenerateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { leadId: string; program: string; callNotes: string }) => generateProposal(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proposals'] }); },
  });
}

export function useUpdateProposalStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateProposalStatus(id, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['proposals'] }); },
  });
}
