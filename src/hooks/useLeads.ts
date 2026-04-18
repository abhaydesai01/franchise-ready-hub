import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchLeads,
  fetchLead,
  createLead,
  updateLeadStage,
  updateLead,
  fetchLeadActivity,
  addLeadNote,
  fetchLeadJourney,
  fetchLeadConversation,
  fetchLeadHealthMap,
  fetchLeadBriefing,
} from '@/lib/api';
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

export function useLeadJourney(leadId: string) {
  return useQuery({
    queryKey: ['leadJourney', leadId],
    queryFn: () => fetchLeadJourney(leadId),
    enabled: !!leadId,
  });
}

export function useLeadConversation(leadId: string) {
  return useQuery({
    queryKey: ['leadConversation', leadId],
    queryFn: () => fetchLeadConversation(leadId),
    enabled: !!leadId,
  });
}

export function useLeadBriefing(leadId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['leadBriefing', leadId],
    queryFn: () => fetchLeadBriefing(leadId),
    enabled: !!leadId && enabled,
  });
}

export function useLeadHealthMap() {
  return useQuery({
    queryKey: ['leadHealthMap'],
    queryFn: fetchLeadHealthMap,
  });
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
    mutationFn: (vars: {
      id: string;
      stage: string;
      track?: string;
      pipelineStageId?: string;
    }) => updateLeadStage(vars.id, vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
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
