import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
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
  triggerVaaniTestCall,
  refreshLeadVoiceFromVaani,
  deleteLead,
  deleteLeadsBulk,
  importLeads,
} from '@/lib/api';
import type { Lead } from '@/types';

type LeadsListData = { leads: Lead[]; total: number };

export function useLeads(
  params?: { track?: string; stage?: string; search?: string; assignedTo?: string; page?: number; limit?: number },
  options?: Omit<UseQueryOptions<LeadsListData, Error, LeadsListData>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<LeadsListData, Error>({
    queryKey: ['leads', params],
    queryFn: () => fetchLeads(params),
    ...options,
  });
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

export function useTriggerVaaniTestCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { leadId: string; phoneOverride?: string }) =>
      triggerVaaniTestCall(
        vars.leadId,
        vars.phoneOverride ? { phoneOverride: vars.phoneOverride } : undefined,
      ),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lead', vars.leadId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leadActivity', vars.leadId] });
      qc.invalidateQueries({ queryKey: ['voiceCallActivity'] });
    },
  });
}

export function useRefreshLeadVoiceFromVaani() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { leadId: string; vaaniCallId: string }) =>
      refreshLeadVoiceFromVaani(vars.leadId, vars.vaaniCallId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['lead', vars.leadId] });
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leadActivity', vars.leadId] });
      qc.invalidateQueries({ queryKey: ['voiceCallActivity'] });
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteLead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leadHealthMap'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteLeadsBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadIds: string[]) => deleteLeadsBulk(leadIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leadHealthMap'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useImportLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: unknown[]) => importLeads(rows),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leadHealthMap'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
