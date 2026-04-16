// API layer — currently uses mock data, swap to fetch('/api/...') for real backend
import {
  leads, activities, calls, proposals, sequences, automationLogs,
  clients, notifications, dashboardStats, settings, team
} from './mockData';
import type {
  Lead, Activity, DiscoveryCall, Proposal, AutomationSequence,
  AutomationLog, Client, Notification, TeamMember, DashboardStats, Settings
} from '@/types';

// Simulate network delay
const delay = (ms = 200) => new Promise(r => setTimeout(r, ms));

// Dashboard
export async function fetchDashboardStats(): Promise<DashboardStats> {
  await delay();
  return dashboardStats;
}

// Leads
export async function fetchLeads(params?: {
  track?: string; stage?: string; search?: string;
  assignedTo?: string; page?: number; limit?: number;
}): Promise<{ leads: Lead[]; total: number }> {
  await delay();
  let filtered = [...leads];
  if (params?.track) filtered = filtered.filter(l => l.track === params.track);
  if (params?.stage) filtered = filtered.filter(l => l.stage === params.stage);
  if (params?.search) {
    const s = params.search.toLowerCase();
    filtered = filtered.filter(l =>
      l.name.toLowerCase().includes(s) ||
      l.phone.includes(s) ||
      l.email.toLowerCase().includes(s)
    );
  }
  if (params?.assignedTo) filtered = filtered.filter(l => l.assignedTo === params.assignedTo);
  const total = filtered.length;
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 25;
  const start = (page - 1) * limit;
  return { leads: filtered.slice(start, start + limit), total };
}

export async function fetchLead(id: string): Promise<Lead | undefined> {
  await delay();
  return leads.find(l => l.id === id);
}

export async function createLead(data: Partial<Lead>): Promise<Lead> {
  await delay();
  const newLead: Lead = {
    id: `l${Date.now()}`,
    name: data.name || '',
    phone: data.phone || '',
    email: data.email || '',
    source: data.source || 'Other',
    track: 'Not Ready',
    stage: 'Gap Nurture',
    status: 'New',
    score: 0,
    scoreDimensions: [
      { name: 'Capital', score: 0, max: 25 },
      { name: 'Experience', score: 0, max: 25 },
      { name: 'Location', score: 0, max: 20 },
      { name: 'Commitment', score: 0, max: 15 },
      { name: 'Timeline', score: 0, max: 15 },
    ],
    assignedTo: data.assignedTo || '',
    notes: data.notes || '',
    createdAt: new Date().toISOString().split('T')[0],
    lastActivity: 'Just now',
    lastActivityType: 'Lead added',
    stageDuration: 0,
  };
  leads.unshift(newLead);
  return newLead;
}

export async function updateLeadStage(id: string, stage: string, track?: string): Promise<Lead | undefined> {
  await delay();
  const lead = leads.find(l => l.id === id);
  if (lead) {
    lead.stage = stage as any;
    if (track) lead.track = track as any;
    lead.lastActivity = 'Just now';
    lead.lastActivityType = 'Stage changed';
    lead.stageDuration = 0;
  }
  return lead;
}

export async function updateLead(id: string, data: Partial<Lead>): Promise<Lead | undefined> {
  await delay();
  const lead = leads.find(l => l.id === id);
  if (lead) Object.assign(lead, data);
  return lead;
}

// Activity
export async function fetchLeadActivity(leadId: string): Promise<Activity[]> {
  await delay();
  return activities.filter(a => a.leadId === leadId);
}

export async function addLeadNote(leadId: string, text: string, addedBy: string): Promise<Activity> {
  await delay();
  const lead = leads.find(l => l.id === leadId);
  const note: Activity = {
    id: `a${Date.now()}`,
    leadId,
    leadName: lead?.name || '',
    type: 'note_added',
    description: text,
    timestamp: new Date().toISOString(),
    addedBy,
  };
  activities.unshift(note);
  return note;
}

// Calls
export async function fetchCalls(params?: { status?: string; date?: string }): Promise<DiscoveryCall[]> {
  await delay();
  let filtered = [...calls];
  if (params?.status) filtered = filtered.filter(c => c.status === params.status);
  return filtered;
}

export async function updateCall(id: string, data: Partial<DiscoveryCall>): Promise<DiscoveryCall | undefined> {
  await delay();
  const call = calls.find(c => c.id === id);
  if (call) Object.assign(call, data);
  return call;
}

// Proposals
export async function fetchProposals(params?: { status?: string; leadId?: string }): Promise<Proposal[]> {
  await delay();
  let filtered = [...proposals];
  if (params?.status && params.status !== 'All') filtered = filtered.filter(p => p.status === params.status);
  if (params?.leadId) filtered = filtered.filter(p => p.leadId === params.leadId);
  return filtered;
}

export async function generateProposal(data: { leadId: string; program: string; callNotes: string }): Promise<Proposal> {
  await delay(1500);
  const lead = leads.find(l => l.id === data.leadId);
  const newProposal: Proposal = {
    id: `p${Date.now()}`,
    leadId: data.leadId,
    leadName: lead?.name || '',
    track: lead?.track || 'Franchise Ready',
    program: data.program as any,
    status: 'Draft',
    content: `<h2>${data.program} Program — ${lead?.name}</h2><p>Based on your discovery call and franchise score of ${lead?.score}/100, we recommend the ${data.program} program.</p><h3>Key Highlights</h3><ul><li>Personalized franchise matching</li><li>Due diligence support</li><li>Negotiation assistance</li><li>Post-launch support</li></ul><h3>Investment & Timeline</h3><p>${data.program === 'Franchise Ready' ? '3-month' : data.program === 'Franchise Launch' ? '6-month' : '12-month'} engagement with dedicated consultant support.</p><h3>Next Steps</h3><p>1. Review and sign this proposal<br/>2. Complete onboarding documentation<br/>3. Begin franchise discovery phase</p>`,
    createdAt: new Date().toISOString().split('T')[0],
    sentAt: null,
    openedAt: null,
    signedAt: null,
  };
  proposals.unshift(newProposal);
  return newProposal;
}

export async function updateProposalStatus(id: string, status: string): Promise<Proposal | undefined> {
  await delay();
  const proposal = proposals.find(p => p.id === id);
  if (proposal) {
    proposal.status = status as any;
    if (status === 'Sent') proposal.sentAt = new Date().toISOString().split('T')[0];
    if (status === 'Signed') proposal.signedAt = new Date().toISOString().split('T')[0];
  }
  return proposal;
}

// Automation
export async function fetchSequences(): Promise<AutomationSequence[]> {
  await delay();
  return sequences;
}

export async function updateSequence(id: string, data: Partial<AutomationSequence>): Promise<AutomationSequence | undefined> {
  await delay();
  const seq = sequences.find(s => s.id === id);
  if (seq) Object.assign(seq, data);
  return seq;
}

export async function fetchAutomationLogs(params?: {
  leadId?: string; channel?: string; status?: string; page?: number;
}): Promise<AutomationLog[]> {
  await delay();
  let filtered = [...automationLogs];
  if (params?.channel) filtered = filtered.filter(l => l.channel === params.channel);
  if (params?.status) filtered = filtered.filter(l => l.status === params.status);
  return filtered;
}

// Clients
export async function fetchClients(): Promise<Client[]> {
  await delay();
  return clients;
}

export async function updateClient(id: string, data: Partial<Client>): Promise<Client | undefined> {
  await delay();
  const client = clients.find(c => c.id === id);
  if (client) Object.assign(client, data);
  return client;
}

// Notifications
export async function fetchNotifications(): Promise<Notification[]> {
  await delay();
  return notifications;
}

export async function markAllNotificationsRead(): Promise<void> {
  await delay();
  notifications.forEach(n => { n.read = true; });
}

// Team
export async function fetchTeam(): Promise<TeamMember[]> {
  await delay();
  return team;
}

export async function inviteTeamMember(data: { email: string; role: string }): Promise<TeamMember> {
  await delay();
  const member: TeamMember = {
    id: `t${Date.now()}`,
    name: data.email.split('@')[0],
    email: data.email,
    role: data.role as any,
    avatarInitials: data.email.substring(0, 2).toUpperCase(),
    addedDate: new Date().toISOString().split('T')[0],
  };
  team.push(member);
  return member;
}

export async function removeTeamMember(id: string): Promise<void> {
  await delay();
  const idx = team.findIndex(t => t.id === id);
  if (idx > -1) team.splice(idx, 1);
}

// Settings
export async function fetchSettings(): Promise<Settings> {
  await delay();
  return settings;
}

export async function updateSettings(data: Partial<Settings>): Promise<Settings> {
  await delay();
  Object.assign(settings, data);
  return settings;
}

// Activities (global)
export async function fetchActivities(): Promise<Activity[]> {
  await delay();
  return activities;
}
