// API layer — domain reads/writes go to Nest (`VITE_API_URL`).
import type {
  Lead,
  LeadBriefing,
  PostCallNotes,
  LeadDocumentEntry,
  Activity,
  JourneyEvent,
  DiscoveryCall,
  Proposal,
  AutomationSequence,
  AutomationLog,
  Client,
  Notification,
  TeamMember,
  DashboardStats,
  Settings,
  AvailabilitySettings,
  CalendarIntegrationStatus,
  CalendarTestSlot,
  UpcomingCallRow,
  PipelineStageDefinition,
  WAConversation,
} from '@/types';
import type { ReEngagementLog, ReEngagementRule, SalesAlert } from '@/types/sales';
import type {
  LeadHealth,
  LossReasonStat,
  LeadLoss,
  ResponseTimeConversion,
  SourceConversion,
  StageDropoff,
} from '@/types/sales';
import { getAccessToken, setAuth, clearAuth } from '@/hooks/useAuth';

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001/api/v1';

export function getApiBase(): string {
  return API_BASE;
}

/* ── Token refresh helper ── */
let refreshPromise: Promise<string | null> | null = null;

function getRefreshToken(): string | null {
  try {
    const raw = window.localStorage.getItem('franchise-ready-auth');
    if (!raw) return null;
    return JSON.parse(raw)?.refreshToken ?? null;
  } catch { return null; }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) { clearAuth(); return null; }
    const data = await res.json() as { accessToken: string; user: any };
    // Update stored auth with new access token, keep the same refresh token
    setAuth({ accessToken: data.accessToken, refreshToken, user: data.user });
    return data.accessToken;
  } catch { clearAuth(); return null; }
}

export const DEFAULT_AVAILABILITY: AvailabilitySettings = {
  slotDurationMinutes: 30,
  bufferBetweenSlots: 0,
  workingHours: {
    monday: { start: '09:00', end: '18:00', enabled: true },
    tuesday: { start: '09:00', end: '18:00', enabled: true },
    wednesday: { start: '09:00', end: '18:00', enabled: true },
    thursday: { start: '09:00', end: '18:00', enabled: true },
    friday: { start: '09:00', end: '18:00', enabled: true },
    saturday: { start: '10:00', end: '14:00', enabled: true },
    sunday: { start: '09:00', end: '18:00', enabled: false },
  },
  timezone: 'Asia/Kolkata',
  advanceBookingDays: 30,
  slotsToOfferInBot: 3,
  meetingTitle: 'Franchise Discovery Call',
  ghlBookingLink: '',
};

async function apiRequest<T>(
  path: string,
  options: RequestInit & { auth?: boolean; _retried?: boolean } = {},
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };

  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Auto-refresh on 401 and retry once
  if (res.status === 401 && options.auth !== false && !options._retried) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      return apiRequest<T>(path, { ...options, _retried: true });
    }
  }

  if (!res.ok) {
    let message = 'Request failed';
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

function mapRoleToFrontend(role: string): TeamMember['role'] {
  if (role === 'admin') return 'Admin';
  if (role === 'manager') return 'Manager';
  return 'Consultant';
}

function mapRoleToBackend(role: string): 'admin' | 'manager' | 'rep' {
  if (role.toLowerCase() === 'admin') return 'admin';
  if (role.toLowerCase() === 'manager') return 'manager';
  return 'rep';
}

function mapLeadSource(source: unknown): Lead['source'] {
  const raw = String(source ?? '').toLowerCase().replace(/\s+/g, '_');
  if (raw === 'meta_ad' || raw === 'meta_ads') return 'Meta Ad';
  if (raw === 'whatsapp_inbound' || raw === 'whatsapp') return 'WhatsApp Inbound';
  if (raw === 'referral') return 'Referral';
  if (raw === 'direct') return 'Direct';
  return 'Other';
}

function mapLeadFromApi(raw: unknown): Lead {
  const row = raw as Record<string, unknown> & { _id: unknown };
  const pid = row.pipelineStageId;

  return {
    id: String(row._id),
    name: String(row.name ?? ''),
    phone: (row.phone as string | undefined) ?? '',
    email: (row.email as string | undefined) ?? '',
    company: (row.company as string | undefined) ?? undefined,
    source: mapLeadSource(row.source),
    track: (row.track as Lead['track']) ?? 'Not Ready',
    stage: (row.stage as Lead['stage']) ?? 'Gap Nurture',
    status: (row.status as Lead['status']) ?? 'New',
    score: Number(row.score ?? 0),
    scoreDimensions: (row.scoreDimensions as Lead['scoreDimensions']) ?? [],
    assignedTo: (row.assignedTo as string | undefined) ?? '',
    notes: (row.notes as string | undefined) ?? '',
    createdAt:
      typeof row.createdAt === 'string'
        ? row.createdAt
        : row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : '',
    lastActivity: (row.lastActivity as string | undefined) ?? '',
    lastActivityType: (row.lastActivityType as string | undefined) ?? '',
    stageDuration: Number(row.stageDuration ?? 0),
    campaign: row.campaign as Lead['campaign'],
    waConversationId: row.waConversationId as string | undefined,
    metaLeadId: row.metaLeadId as string | undefined,
    metaFormId: row.metaFormId as string | undefined,
    utmSource: row.utmSource as string | undefined,
    utmMedium: row.utmMedium as string | undefined,
    utmCampaign: row.utmCampaign as string | undefined,
    pipelineStageId:
      pid != null && pid !== '' ? String(pid as string | { toString(): string }) : undefined,
    discoveryCall: mapDiscoveryCall(row.discoveryCall),
    callNotes: mapCallNotes(row.callNotes),
    documents: mapLeadDocuments(row.documents),
  };
}

function mapLeadDocuments(raw: unknown): LeadDocumentEntry[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const out: LeadDocumentEntry[] = [];
  for (const d of raw) {
    if (!d || typeof d !== 'object') continue;
    const o = d as Record<string, unknown>;
    const id = o._id != null ? String(o._id) : '';
    const docType = o.documentType ?? o.type;
    const t =
      docType === 'proposal' || docType === 'mom' ? docType : null;
    if (!t || !id) continue;
    const url = typeof o.url === 'string' ? o.url : '';
    const gen = o.generatedAt;
    const generatedAt =
      typeof gen === 'string'
        ? gen
        : gen instanceof Date
          ? gen.toISOString()
          : '';
    const st = o.status;
    const status =
      st === 'pending_review' ||
      st === 'approved' ||
      st === 'sent' ||
      st === 'signed'
        ? st
        : 'pending_review';
    const pvc = o.proposalViewCount;
    const proposalViewCount =
      typeof pvc === 'number' && !Number.isNaN(pvc) ? pvc : undefined;
    const plv = o.proposalLastViewedAt;
    const proposalLastViewedAt =
      typeof plv === 'string'
        ? plv
        : plv instanceof Date
          ? plv.toISOString()
          : undefined;
    const sa = o.signedAt;
    const signedAt =
      typeof sa === 'string'
        ? sa
        : sa instanceof Date
          ? sa.toISOString()
          : undefined;
    out.push({
      id,
      type: t,
      url,
      generatedAt,
      status,
      proposalViewCount,
      proposalLastViewedAt,
      signedAt,
    });
  }
  return out.length ? out : undefined;
}

function mapCallNotes(raw: unknown): Lead['callNotes'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const sa = o.submittedAt;
  const submittedAt =
    typeof sa === 'string'
      ? sa
      : sa instanceof Date
        ? sa.toISOString()
        : undefined;
  if (!o.outcome || !o.engagementScope || !o.consultantNotes || !o.docRequired || !o.nextStep) {
    return undefined;
  }
  return {
    outcome: o.outcome as PostCallNotes['outcome'],
    serviceType: o.serviceType as PostCallNotes['serviceType'] | undefined,
    engagementScope: String(o.engagementScope),
    priceDiscussed:
      o.priceDiscussed === undefined || o.priceDiscussed === null
        ? undefined
        : Number(o.priceDiscussed),
    objections: o.objections != null ? String(o.objections) : undefined,
    commitments: o.commitments != null ? String(o.commitments) : undefined,
    consultantNotes: String(o.consultantNotes),
    docRequired: o.docRequired as PostCallNotes['docRequired'],
    nextStep: String(o.nextStep),
    submittedAt,
  };
}

function mapDiscoveryCall(raw: unknown): Lead['discoveryCall'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const iso = (v: unknown) =>
    typeof v === 'string'
      ? v
      : v instanceof Date
        ? v.toISOString()
        : undefined;
  const scheduledAt = iso(o.scheduledAt);
  const endTime = iso(o.endTime);
  const meetingLink = typeof o.meetingLink === 'string' ? o.meetingLink : undefined;
  const meetLink = typeof o.meetLink === 'string' ? o.meetLink : undefined;
  const googleEventId =
    typeof o.googleEventId === 'string' ? o.googleEventId : undefined;
  const outlookEventId =
    typeof o.outlookEventId === 'string' ? o.outlookEventId : undefined;
  const st = o.status;
  const status =
    st === 'scheduled' || st === 'cancelled' || st === 'completed'
      ? st
      : undefined;
  const completedAt = iso(o.completedAt);
  const bookedVia = o.bookedVia;
  const bv =
    bookedVia === 'crm_bot' || bookedVia === 'crm_voice' || bookedVia === 'ghl_link'
      ? bookedVia
      : undefined;
  const reminderJobIds = Array.isArray(o.reminderJobIds)
    ? (o.reminderJobIds as unknown[]).map((x) => String(x))
    : undefined;

  if (
    !scheduledAt &&
    !endTime &&
    !meetingLink &&
    !meetLink &&
    !status &&
    !completedAt &&
    !googleEventId &&
    !outlookEventId &&
    !bv
  ) {
    return undefined;
  }

  return {
    scheduledAt,
    endTime,
    meetingLink,
    meetLink,
    googleEventId,
    outlookEventId,
    status,
    completedAt,
    bookedVia: bv,
    reminderJobIds,
  };
}

// Dashboard
export async function fetchDashboardStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>(`/analytics/summary`);
}

export async function fetchLossAnalytics(): Promise<{
  stageDropoffs: StageDropoff[];
  lossReasonStats: LossReasonStat[];
  sourceConversions: SourceConversion[];
  responseTimeConversions: ResponseTimeConversion[];
  lostLeads: LeadLoss[];
}> {
  return apiRequest(`/analytics/loss-report`);
}

// Leads
export async function fetchLeads(params?: {
  track?: string; stage?: string; search?: string;
  assignedTo?: string; page?: number; limit?: number;
}): Promise<{ leads: Lead[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.track) searchParams.set('track', params.track);
  if (params?.stage) searchParams.set('stage', params.stage);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.assignedTo) searchParams.set('assignedTo', params.assignedTo);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const query = searchParams.toString();
  const result = await apiRequest<{ leads: unknown[]; total: number }>(
    `/leads${query ? `?${query}` : ''}`,
  );

  return { leads: result.leads.map(mapLeadFromApi), total: result.total };
}

export async function fetchLead(id: string): Promise<Lead> {
  const lead = await apiRequest<unknown>(`/leads/${id}`);
  return mapLeadFromApi(lead);
}

export async function markDiscoveryCallComplete(leadId: string): Promise<Lead> {
  const raw = await apiRequest<unknown>(`/leads/${leadId}/discovery-call`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed' }),
  });
  return mapLeadFromApi(raw);
}

export type PostCallNotesPayload = {
  outcome: 'ready_to_proceed' | 'needs_more_time' | 'not_interested';
  serviceType?: 'full_consulting' | 'recruitment_only' | 'needs_development';
  engagementScope: string;
  priceDiscussed?: number;
  objections?: string;
  commitments?: string;
  consultantNotes: string;
  docRequired: 'proposal' | 'mom' | 'none';
  nextStep: string;
};

export async function submitPostCallNotes(
  leadId: string,
  body: PostCallNotesPayload,
): Promise<{ lead: Lead; docTriggered: 'proposal' | 'mom' | null }> {
  const res = await apiRequest<{ lead: unknown; docTriggered: 'proposal' | 'mom' | null }>(
    `/leads/${leadId}/post-call-notes`,
    { method: 'POST', body: JSON.stringify(body) },
  );
  return { lead: mapLeadFromApi(res.lead), docTriggered: res.docTriggered };
}

export async function approveSendLeadDocument(
  leadId: string,
  documentEntryId: string,
): Promise<Lead> {
  const raw = await apiRequest<unknown>(
    `/leads/${leadId}/documents/${documentEntryId}/approve-send`,
    { method: 'POST' },
  );
  return mapLeadFromApi(raw);
}

export async function fetchLeadHealthMap(): Promise<Record<string, LeadHealth>> {
  return apiRequest<Record<string, LeadHealth>>(`/leads/health`);
}

export async function fetchLeadJourney(leadId: string): Promise<JourneyEvent[]> {
  return apiRequest<JourneyEvent[]>(`/leads/${leadId}/journey`);
}

export async function fetchLeadConversation(leadId: string): Promise<WAConversation | null> {
  return apiRequest<WAConversation | null>(`/leads/${leadId}/whatsapp`);
}

export async function fetchLeadBriefing(leadId: string): Promise<LeadBriefing> {
  return apiRequest<LeadBriefing>(`/leads/${leadId}/briefing`);
}

export async function downloadLeadBriefingPdf(leadId: string): Promise<void> {
  const token = getAccessToken();
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/leads/${leadId}/briefing/pdf`, { headers });
  if (!res.ok) {
    let message = 'Could not download PDF';
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition');
  let filename = `briefing-${leadId}.pdf`;
  const m = cd?.match(/filename="?([^";]+)"?/i);
  if (m?.[1]) filename = m[1];
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function createLead(data: Partial<Lead>): Promise<Lead> {
  const created = await apiRequest<unknown>(`/leads`, {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      phone: data.phone,
      email: data.email,
      source: data.source,
      ...(data.pipelineStageId ? { pipelineStageId: data.pipelineStageId } : {}),
      ...(data.assignedTo ? { assignedTo: data.assignedTo } : {}),
      notes: data.notes,
    }),
  });
  return mapLeadFromApi(created);
}

export async function fetchPipelineStages(track?: string): Promise<PipelineStageDefinition[]> {
  const q = track ? `?track=${encodeURIComponent(track)}` : '';
  const rows = await apiRequest<Array<Record<string, unknown> & { _id: unknown }>>(
    `/pipeline/stages${q}`,
  );
  return rows.map((r) => {
    const { _id, ...rest } = r;
    return {
      ...(rest as Omit<PipelineStageDefinition, 'id'>),
      id: String(_id),
    };
  });
}

export async function updateLeadStage(
  id: string,
  params: { stage: string; track?: string; pipelineStageId?: string },
): Promise<Lead | undefined> {
  const body =
    params.pipelineStageId != null && params.pipelineStageId !== ''
      ? { pipelineStageId: params.pipelineStageId }
      : { stage: params.stage, ...(params.track != null ? { track: params.track } : {}) };

  const updated = await apiRequest<unknown>(`/leads/${id}/stage`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return mapLeadFromApi(updated);
}

export async function updateLead(id: string, data: Partial<Lead>): Promise<Lead | undefined> {
  const updated = await apiRequest<unknown>(`/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return mapLeadFromApi(updated);
}

// Activity
export async function fetchLeadActivity(leadId: string): Promise<Activity[]> {
  const result = await apiRequest<Array<Activity & { _id: string }>>(`/leads/${leadId}/activities`);
  return result.map((activity) => ({
    ...activity,
    id: (activity as any)._id as string,
  }));
}

export async function addLeadNote(leadId: string, text: string, addedBy: string): Promise<Activity> {
  const created = await apiRequest<Activity & { _id: string }>(`/leads/${leadId}/activities`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'note_added',
      description: text,
      addedBy,
    }),
  });
  return {
    ...created,
    id: (created as any)._id as string,
  };
}

// Calls
export async function fetchCalls(params?: { status?: string; date?: string }): Promise<DiscoveryCall[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.date) searchParams.set('date', params.date);
  const query = searchParams.toString();

  const result = await apiRequest<Array<DiscoveryCall & { _id: string }>>(
    `/calls${query ? `?${query}` : ''}`,
  );

  return result.map((call) => ({
    ...call,
    id: (call as any)._id as string,
  }));
}

export async function updateCall(id: string, data: Partial<DiscoveryCall>): Promise<DiscoveryCall | undefined> {
  const updated = await apiRequest<DiscoveryCall & { _id: string }>(`/calls/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return {
    ...updated,
    id: (updated as any)._id as string,
  };
}

// Proposals
export async function fetchProposals(params?: { status?: string; leadId?: string }): Promise<Proposal[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.leadId) searchParams.set('leadId', params.leadId);
  const query = searchParams.toString();

  const result = await apiRequest<Array<Proposal & { _id: string }>>(
    `/proposals${query ? `?${query}` : ''}`,
  );

  return result.map((proposal) => ({
    ...proposal,
    id: (proposal as any)._id as string,
  }));
}

export async function generateProposal(data: { leadId: string; program: string; callNotes: string }): Promise<Proposal> {
  const created = await apiRequest<Proposal & { _id: string }>(`/proposals`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return {
    ...created,
    id: (created as any)._id as string,
  };
}

export async function updateProposalStatus(id: string, status: string): Promise<Proposal | undefined> {
  const updated = await apiRequest<Proposal & { _id: string }>(`/proposals/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

  return {
    ...updated,
    id: (updated as any)._id as string,
  };
}

export async function sendProposalViaWhatsApp(id: string): Promise<{ ok: boolean; message: string }> {
  return apiRequest(`/proposals/${id}/send-whatsapp`, { method: 'POST' });
}

export async function sendProposalViaEmail(id: string): Promise<{ ok: boolean; message: string }> {
  return apiRequest(`/proposals/${id}/send-email`, { method: 'POST' });
}

export async function fetchProposalPdf(
  id: string,
): Promise<{ ok: boolean; filename: string; blob: Blob }> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/proposals/${id}/pdf`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error('Failed to download proposal PDF');
  }
  const blob = await res.blob();
  const contentDisposition = res.headers.get('content-disposition') ?? '';
  const match = contentDisposition.match(/filename="([^"]+)"/i);
  const filename = match?.[1] ?? `proposal-${id}.pdf`;
  return {
    ok: true,
    filename,
    blob,
  };
}

// Automation
export async function fetchSequences(): Promise<AutomationSequence[]> {
  const result = await apiRequest<Array<AutomationSequence & { _id: string }>>('/automation/sequences');
  return result.map((row) => {
    const { _id, ...rest } = row as AutomationSequence & { _id: string };
    return { ...rest, id: _id };
  });
}

export async function updateSequence(
  id: string,
  data: Partial<AutomationSequence>,
): Promise<AutomationSequence> {
  const { id: _omitId, ...body } = data as Partial<AutomationSequence> & { id?: string };
  const updated = await apiRequest<AutomationSequence & { _id: string }>(`/automation/sequences/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  const { _id, ...rest } = updated as AutomationSequence & { _id: string };
  return { ...rest, id: _id };
}

export async function fetchAutomationLogs(params?: {
  leadId?: string;
  channel?: string;
  status?: string;
  page?: number;
}): Promise<AutomationLog[]> {
  const searchParams = new URLSearchParams();
  if (params?.leadId) searchParams.set('leadId', params.leadId);
  if (params?.channel) searchParams.set('channel', params.channel);
  if (params?.status) searchParams.set('status', params.status);
  const query = searchParams.toString();

  const result = await apiRequest<Array<AutomationLog & { _id: string }>>(
    `/automation/logs${query ? `?${query}` : ''}`,
  );

  return result.map((row) => {
    const { _id, ...rest } = row as AutomationLog & { _id: string };
    return { ...rest, id: _id };
  });
}

export async function fetchReEngagementRules(): Promise<ReEngagementRule[]> {
  const result = await apiRequest<Array<ReEngagementRule & { _id: string }>>('/automation/re-engagement/rules');
  return result.map((row) => {
    const { _id, ...rest } = row as ReEngagementRule & { _id: string };
    return { ...rest, id: _id };
  });
}

export async function fetchReEngagementLogs(): Promise<ReEngagementLog[]> {
  const result = await apiRequest<Array<ReEngagementLog & { _id: string }>>('/automation/re-engagement/logs');
  return result.map((row) => {
    const { _id, ...rest } = row as ReEngagementLog & { _id: string };
    return { ...rest, id: _id };
  });
}

export async function updateReEngagementRule(id: string, enabled: boolean): Promise<ReEngagementRule> {
  const updated = await apiRequest<ReEngagementRule & { _id: string }>(
    `/automation/re-engagement/rules/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    },
  );
  const { _id, ...rest } = updated as ReEngagementRule & { _id: string };
  return { ...rest, id: _id };
}

// Clients
export async function fetchClients(): Promise<Client[]> {
  const result = await apiRequest<Array<Client & { _id: string }>>(`/clients`);

  return result.map((client) => ({
    ...client,
    id: (client as any)._id as string,
  }));
}

export async function updateClient(id: string, data: Partial<Client>): Promise<Client | undefined> {
  const updated = await apiRequest<Client & { _id: string }>(`/clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

  return {
    ...updated,
    id: (updated as any)._id as string,
  };
}

// Notifications
export async function fetchNotifications(): Promise<Notification[]> {
  const result = await apiRequest<Array<Notification & { _id: string }>>(`/notifications`);
  return result.map((n) => ({
    ...n,
    id: (n as any)._id as string,
  }));
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest(`/notifications/read-all`, { method: 'PATCH' });
}

// Alerts
export async function fetchAlerts(params?: {
  priority?: 'all' | 'critical' | 'warning' | 'info';
}): Promise<SalesAlert[]> {
  const searchParams = new URLSearchParams();
  if (params?.priority) searchParams.set('priority', params.priority);
  const query = searchParams.toString();

  const result = await apiRequest<Array<SalesAlert & { _id: string }>>(
    `/alerts${query ? `?${query}` : ''}`,
  );

  return result.map((a) => ({
    ...a,
    id: (a as any)._id as string,
  }));
}

export async function fetchAlertCounts(): Promise<{
  all: number;
  critical: number;
  warning: number;
  info: number;
}> {
  return apiRequest(`/alerts/counts`);
}

export async function dismissAlert(id: string): Promise<void> {
  await apiRequest(`/alerts/${id}/dismiss`, { method: 'PATCH' });
}

export async function runAlertAction(
  id: string,
  note?: string,
): Promise<{ ok: boolean; message: string; leadId?: string; callId?: string; proposalId?: string }> {
  return apiRequest(`/alerts/${id}/action`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

// Team
export async function fetchTeam(): Promise<TeamMember[]> {
  const users = await apiRequest<Array<{ _id: string; name: string; email: string; role: string; createdAt?: string }>>('/users');
  return users.map((u) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
    role: mapRoleToFrontend(u.role),
    avatarInitials: (u.name || u.email).split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join(''),
    addedDate: (u.createdAt ? String(u.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10)),
  }));
}

export async function inviteTeamMember(data: { email: string; role: string }): Promise<TeamMember> {
  const created = await apiRequest<{ _id: string; name: string; email: string; role: string; createdAt?: string }>(
    '/users/invite',
    {
      method: 'POST',
      body: JSON.stringify({
        email: data.email,
        role: mapRoleToBackend(data.role),
      }),
    },
  );
  return {
    id: String(created._id),
    name: created.name,
    email: created.email,
    role: mapRoleToFrontend(created.role),
    avatarInitials: (created.name || created.email).split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join(''),
    addedDate: (created.createdAt ? String(created.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10)),
  };
}

export async function removeTeamMember(id: string): Promise<void> {
  await apiRequest(`/users/${id}`, { method: 'DELETE' });
}

// Settings
function mapAvailabilityFromApi(raw: unknown): AvailabilitySettings {
  const r = raw as Partial<AvailabilitySettings> & {
    primaryConsultantUserId?: unknown;
  };
  const pid = r.primaryConsultantUserId;
  const primaryConsultantUserId =
    pid && typeof pid === 'object' && pid !== null && '$oid' in (pid as object)
      ? String((pid as { $oid: string }).$oid)
      : typeof pid === 'string'
        ? pid
        : undefined;

  return {
    ...DEFAULT_AVAILABILITY,
    ...r,
    workingHours: {
      ...DEFAULT_AVAILABILITY.workingHours,
      ...(r.workingHours ?? {}),
    },
    primaryConsultantUserId,
  };
}

/** Normalizes any `/settings` JSON payload so `availabilitySettings` is always present and merged with defaults. */
export function normalizeSettingsFromApi(row: Partial<Settings> & { _id?: string }): Settings {
  return {
    calendlyLink: row.calendlyLink ?? '',
    calendlyWebhookSigningKey: row.calendlyWebhookSigningKey ?? '',
    thresholds: row.thresholds!,
    alertRules: row.alertRules!,
    integrations: row.integrations ?? [],
    waTemplates: row.waTemplates ?? [],
    emailTemplates: row.emailTemplates ?? [],
    availabilitySettings: row.availabilitySettings
      ? mapAvailabilityFromApi(row.availabilitySettings)
      : { ...DEFAULT_AVAILABILITY },
  };
}

export async function fetchSettings(): Promise<Settings> {
  const row = await apiRequest<Partial<Settings> & { _id?: string }>(`/settings`);
  return normalizeSettingsFromApi(row);
}

export async function patchAvailability(
  data: Partial<AvailabilitySettings>,
): Promise<Settings> {
  const updated = await apiRequest<Partial<Settings> & { _id?: string }>(
    `/settings/availability`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
  return normalizeSettingsFromApi(updated);
}

export async function fetchCalendarIntegrationStatus(): Promise<CalendarIntegrationStatus> {
  return apiRequest<CalendarIntegrationStatus>(`/calendar/integration-status`);
}

export async function fetchCalendarTestSlots(): Promise<CalendarTestSlot[]> {
  return apiRequest<CalendarTestSlot[]>(`/calendar/test-slots`);
}

export async function fetchCalendarUpcoming(): Promise<UpcomingCallRow[]> {
  return apiRequest<UpcomingCallRow[]>(`/calendar/upcoming`);
}

export async function fetchCalendarAvailableSlots(count = 500): Promise<CalendarTestSlot[]> {
  return apiRequest<CalendarTestSlot[]>(`/calendar/available-slots?count=${count}`);
}

export async function bookCalendarSlot(data: {
  leadId: string;
  startTime: string;
  endTime: string;
}): Promise<{ meetLink: string; labelFull: string; googleEventId?: string }> {
  return apiRequest(`/calendar/book`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  meetLink?: string;
  allDay: boolean;
  status: string;
};

export async function fetchCalendarEvents(timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  return apiRequest<CalendarEvent[]>(
    `/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
  );
}

export async function createCalendarEvent(data: {
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
  attendeeEmail?: string;
  createMeet?: boolean;
}): Promise<{ id: string; meetLink: string | null }> {
  return apiRequest(`/calendar/create-event`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function rescheduleCalendarEvent(
  eventId: string,
  data: { startTime: string; endTime: string },
): Promise<{ ok: boolean }> {
  return apiRequest(`/calendar/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCalendarEvent(eventId: string): Promise<{ ok: boolean }> {
  return apiRequest(`/calendar/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  });
}

export async function disconnectGoogleCalendar(): Promise<{ ok?: boolean }> {
  return apiRequest(`/calendar/google/disconnect`);
}

export async function disconnectOutlookCalendar(): Promise<{ ok?: boolean }> {
  return apiRequest(`/calendar/outlook/disconnect`);
}

export async function testCalendlyWebhook(signingKey?: string): Promise<{
  ok: boolean;
  valid: boolean;
  message: string;
}> {
  return apiRequest(`/settings/calendly/test`, {
    method: 'POST',
    body: JSON.stringify({ signingKey: signingKey ?? '' }),
  });
}

export async function updateSettings(data: Partial<Settings>): Promise<Settings> {
  const updated = await apiRequest<Partial<Settings> & { _id?: string }>(
    `/settings`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
  return normalizeSettingsFromApi(updated);
}

export async function updateIntegrationSetting(
  id: string,
  data: { apiKey?: string; connected?: boolean },
): Promise<Settings> {
  const updated = await apiRequest<Partial<Settings> & { _id?: string }>(
    `/settings/integrations/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
  return normalizeSettingsFromApi(updated);
}

export async function testIntegrationSetting(
  id: string,
): Promise<{ ok: boolean; connected: boolean }> {
  return apiRequest(`/settings/integrations/${id}/test`, {
    method: 'POST',
  });
}

// Activities (global)
export async function fetchActivities(): Promise<Activity[]> {
  const result = await apiRequest<Array<Activity & { _id: string }>>(`/activities`);
  return result.map((activity) => ({
    ...activity,
    id: (activity as any)._id as string,
  }));
}
