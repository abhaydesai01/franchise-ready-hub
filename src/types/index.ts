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

// Meta Ads campaign attribution
export interface CampaignAttribution {
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  adId: string;
  adName: string;
  adCreativeUrl?: string; // thumbnail of the ad creative
  platform: 'Facebook' | 'Instagram' | 'Messenger' | 'Audience Network';
  objective: string; // e.g. 'LEAD_GENERATION', 'MESSAGES'
  costPerLead?: number;
  formId?: string; // Meta Lead Ads form ID
  formName?: string;
}

// WhatsApp conversation
export type WAMessageDirection = 'inbound' | 'outbound';
export type WAMessageType = 'text' | 'image' | 'document' | 'template' | 'button_reply' | 'list_reply' | 'location' | 'contact';
export type WAMessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface WAMessage {
  id: string;
  leadId: string;
  direction: WAMessageDirection;
  type: WAMessageType;
  body: string;
  mediaUrl?: string;
  templateName?: string;
  status: WAMessageStatus;
  timestamp: string;
  agentName?: string; // who sent (for outbound)
}

export interface WAConversation {
  leadId: string;
  phoneNumber: string;
  totalMessages: number;
  lastMessageAt: string;
  isActive: boolean;
  messages: WAMessage[];
}

// Full funnel journey events
export type JourneyEventType =
  | 'ad_impression'
  | 'ad_click'
  | 'form_submitted' // Meta Lead Ads
  | 'wa_opened'      // Click-to-WhatsApp
  | 'wa_first_message'
  | 'wa_agent_reply'
  | 'wa_message_sent'
  | 'wa_message_received'
  | 'wa_template_sent'
  | 'lead_created'
  | 'lead_scored'
  | 'track_assigned'
  | 'stage_changed'
  | 'call_booked'
  | 'call_completed'
  | 'call_noshow'
  | 'proposal_sent'
  | 'proposal_opened'
  | 'proposal_signed'
  | 'email_sent'
  | 'email_opened'
  | 'note_added'
  | 'client_signed'
  | 'sequence_started'
  | 'sequence_step';

export interface JourneyEvent {
  id: string;
  leadId: string;
  type: JourneyEventType;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean>;
  source?: 'meta_ads' | 'whatsapp' | 'crm' | 'automation' | 'manual';
  channel?: 'facebook' | 'instagram' | 'whatsapp' | 'email' | 'voice' | 'web';
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
  stageDuration: number;
  // Meta & WhatsApp enrichment
  campaign?: CampaignAttribution;
  waConversationId?: string;
  metaLeadId?: string; // Meta's lead ID from Lead Ads
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
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
