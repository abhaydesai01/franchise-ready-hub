import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchLeads, fetchLead, createLead, updateLeadStage, updateLead, fetchLeadActivity, addLeadNote } from '@/lib/api';
import type { Lead } from '@/types';

export function useLeads(params?: { track?: string; stage?: string; search?: string; assignedTo?: string; page?: number; limit?: number }) {
  return useQuery({ queryKey: ['leads', params], queryFn: () => fetchLeads(params) });
}

export function useLead(id: string) {
  return useQuery({ queryKey: ['lead', id], queryFn: () => fetchLead(id), enabled: !!id });
}

export function useLeadActivity(leadId: string) {
  return useQuery({ queryKey: ['leadActivity', leadId], queryFn: () => fetchLeadActivity(leadId), enabled: !!leadId });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Lead>) => createLead(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });
}

export function useUpdateLeadStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage, track }: { id: string; stage: string; track?: string }) => updateLeadStage(id, stage, track),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Lead> }) => updateLead(id, data),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['lead', vars.id] }); qc.invalidateQueries({ queryKey: ['leads'] }); },
  });
}

export function useAddLeadNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, text, addedBy }: { leadId: string; text: string; addedBy: string }) => addLeadNote(leadId, text, addedBy),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['leadActivity', vars.leadId] }); qc.invalidateQueries({ queryKey: ['activities'] }); },
  });
}
