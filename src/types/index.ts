export type Track = 'Not Ready' | 'Franchise Ready' | 'Recruitment Only';

export type NotReadyStage = 'Gap Nurture' | 'Not Early' | 'Discovery Call' | 'Convert to Consulting';
export type FranchiseReadyStage = 'Discovery Booked' | 'Reminders Sent' | 'Proposal Sent' | 'Signed';
export type RecruitmentStage = 'Routed to Eden';
export type Stage = NotReadyStage | FranchiseReadyStage | RecruitmentStage;

export type LeadStatus = 'New' | 'Scoring' | 'Nurture' | 'Active' | 'Signed' | 'Dead';
export type Source = 'Meta Ad' | 'WhatsApp Inbound' | 'Referral' | 'Direct' | 'Other';

export interface ScoreDimension {
  name: string;
  score: number;
  max: number;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: Source;
  track: Track;
  stage: Stage;
  status: LeadStatus;
  score: number;
  scoreDimensions: ScoreDimension[];
  assignedTo: string;
  notes: string;
  createdAt: string;
  lastActivity: string;
  lastActivityType: string;
  stageDuration: number; // days
}

export interface Activity {
  id: string;
  leadId: string;
  leadName: string;
  type: 'lead_added' | 'stage_changed' | 'wa_sent' | 'email_opened' | 'call_booked' | 'proposal_sent' | 'client_signed' | 'note_added';
  description: string;
  timestamp: string;
  addedBy?: string;
}

export interface DiscoveryCall {
  id: string;
  leadId: string;
  leadName: string;
  track: Track;
  score: number;
  scheduledAt: string;
  status: 'upcoming' | 'completed' | 'noshow';
  notes: string;
  proposalGenerated: boolean;
  consultantName: string;
  calcomLink: string;
  followUpSent?: boolean;
}

export interface Proposal {
  id: string;
  leadId: string;
  leadName: string;
  track: Track;
  program: 'Franchise Ready' | 'Franchise Launch' | 'Franchise Performance';
  status: 'Draft' | 'Sent' | 'Opened' | 'Signed' | 'Rejected';
  content: string;
  createdAt: string;
  sentAt: string | null;
  openedAt: string | null;
  signedAt: string | null;
}

export interface AutomationStep {
  id: string;
  stepNumber: number;
  delay: number;
  delayUnit: 'hours' | 'days';
  channel: 'WhatsApp' | 'Email' | 'Voice';
  template: string;
}

export interface AutomationSequence {
  id: string;
  name: string;
  track: Track;
  steps: AutomationStep[];
  activeLeads: number;
  lastTriggered: string;
}

export interface AutomationLog {
  id: string;
  leadId: string;
  leadName: string;
  sequenceName: string;
  step: number;
  channel: 'WhatsApp' | 'Email' | 'Voice';
  status: 'Pending' | 'Sent' | 'Opened' | 'Failed';
  sentAt: string;
  openedAt: string | null;
}

export interface Client {
  id: string;
  leadId: string;
  name: string;
  signedDate: string;
  program: 'Franchise Ready' | 'Franchise Launch' | 'Franchise Performance';
  onboardingStatus: 'Pending' | 'In Progress' | 'Complete';
  onboardingProgress: number;
  referralCode: string;
  referrals: { name: string; stage: Stage; addedDate: string }[];
}

export interface Notification {
  id: string;
  type: Activity['type'];
  description: string;
  leadId?: string;
  timestamp: string;
  read: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Consultant' | 'Manager';
  avatarInitials: string;
  addedDate: string;
}

export interface DashboardStats {
  totalLeads: number;
  notReady: number;
  franchiseReady: number;
  recruitmentOnly: number;
  signedClients: number;
  weeklyDeltas: {
    totalLeads: number;
    notReady: number;
    franchiseReady: number;
    recruitmentOnly: number;
    signedClients: number;
  };
  funnel: { stage: string; count: number }[];
  todayAgenda: {
    id: string;
    leadName: string;
    leadId: string;
    type: 'call' | 'proposal_followup' | 'wa_followup' | 'sequence_step';
    time: string;
    label: string;
  }[];
}

export interface WATemplate {
  id: string;
  name: string;
  body: string;
  channel: 'WhatsApp';
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isHtml: boolean;
  channel: 'Email';
}

export interface Integration {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  apiKey: string;
}

export interface Settings {
  thresholds: {
    notReadyBelow: number;
    franchiseReadyMin: number;
    franchiseReadyMax: number;
  };
  integrations: Integration[];
  waTemplates: WATemplate[];
  emailTemplates: EmailTemplate[];
}
