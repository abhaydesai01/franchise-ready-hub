export type Track = 'Not Ready' | 'Franchise Ready' | 'Recruitment Only';

export type NotReadyStage = 'Gap Nurture' | 'Not Early' | 'Discovery Call' | 'Convert to Consulting';
export type FranchiseReadyStage = 'Discovery Booked' | 'Reminders Sent' | 'Proposal Sent' | 'Signed';
export type RecruitmentStage = 'Routed to Eden';
/** Includes API stage from Calendly webhook (`call_booked`). */
export type Stage =
  | NotReadyStage
  | FranchiseReadyStage
  | RecruitmentStage
  | 'call_booked'
  | 'post_call';

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

/** Optimizer (voice provider) attempt stored on lead */
export interface VoiceCallEntry {
  vaaniCallId: string;
  vaaniDispatchId?: string;
  triggeredAt: string;
  triggerReason: string;
  status: string;
  duration: number;
  transcript: string;
  summary: string;
  sentiment: string;
  entities: Record<string, unknown>;
  /** Raw `conversation_eval` from provider call_details. */
  conversationEval?: Record<string, unknown>;
  callEvalTag?: string;
  recordingUrl: string;
  outcome: string;
  callbackRequestedAt?: string;
  slotOfferedIndex?: number;
  completedAt?: string;
  lastEnrichedAt?: string;
}

/** One row from `GET /leads/voice-calls` (flattened voice attempt + lead). */
export interface VoiceCallActivityItem {
  leadId: string;
  leadName: string;
  leadPhone: string;
  leadStage: string;
  leadTrack: string;
  call: VoiceCallEntry;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  company?: string;
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
  voiceCalls?: VoiceCallEntry[];
  /** Mongo pipeline stage id when loaded from the API */
  pipelineStageId?: string;
  // Meta & WhatsApp enrichment
  campaign?: CampaignAttribution;
  waConversationId?: string;
  metaLeadId?: string; // Meta's lead ID from Lead Ads
  metaFormId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** When set, discovery call is scheduled (Calendly, GHL, or CRM calendar engine). */
  discoveryCall?: {
    scheduledAt?: string;
    endTime?: string;
    meetingLink?: string;
    meetLink?: string;
    googleEventId?: string;
    outlookEventId?: string;
    status?: 'scheduled' | 'cancelled' | 'completed';
    completedAt?: string;
    bookedVia?: 'crm_bot' | 'crm_voice' | 'ghl_link';
    reminderJobIds?: string[];
  };
  callNotes?: PostCallNotes;
  documents?: LeadDocumentEntry[];
}

export type LeadDocumentEntry = {
  id: string;
  type: 'proposal' | 'mom';
  url: string;
  generatedAt: string;
  status: 'pending_review' | 'approved' | 'sent' | 'signed';
  proposalViewCount?: number;
  proposalLastViewedAt?: string;
  signedAt?: string;
};

export interface PostCallNotes {
  outcome: 'ready_to_proceed' | 'needs_more_time' | 'not_interested';
  serviceType?: 'full_consulting' | 'recruitment_only' | 'needs_development';
  engagementScope: string;
  priceDiscussed?: number;
  objections?: string;
  commitments?: string;
  consultantNotes: string;
  docRequired: 'proposal' | 'mom' | 'none';
  nextStep: string;
  submittedAt?: string;
}

/** GET /leads/:id/briefing */
export interface LeadBriefing {
  leadProfile: {
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    metaAdSource: string | null;
    utmCampaign: string | null;
    createdAt: string;
  };
  scorecardSummary: {
    totalScore: number | null;
    readinessBand: string | null;
    intentSignal: string | null;
    dimensions: Array<{ label: string; score: number; max: number }>;
    gapAreas: Array<{ title: string; description: string }>;
    scorecardPdfUrl: string | null;
  };
  conversationSummary: Array<{
    direction: 'inbound' | 'outbound';
    timestamp: string;
    body: string;
  }>;
  callDetails: {
    scheduledAt: string | null;
    meetingLink: string | null;
    consultantName: string | null;
  };
  talkTrack: string;
}

/** Column definition from `GET /pipeline/stages` */
export interface PipelineStageDefinition {
  id: string;
  name: string;
  track: string;
  order: number;
  probability: number;
  color: string;
  isActive: boolean;
}

export interface Activity {
  id: string;
  leadId: string;
  leadName: string;
  type:
    | 'lead_added'
    | 'stage_changed'
    | 'wa_sent'
    | 'email_opened'
    | 'call_booked'
    | 'call_cancelled'
    | 'call_rescheduled'
    | 'proposal_sent'
    | 'client_signed'
    | 'note_added';
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
  /** From automation logs; null if the sequence has never sent a step. */
  lastTriggered: string | null;
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

export interface DayHoursConfig {
  start: string;
  end: string;
  enabled: boolean;
}

export interface WorkingHoursConfig {
  monday: DayHoursConfig;
  tuesday: DayHoursConfig;
  wednesday: DayHoursConfig;
  thursday: DayHoursConfig;
  friday: DayHoursConfig;
  saturday: DayHoursConfig;
  sunday: DayHoursConfig;
}

export interface AvailabilitySettings {
  slotDurationMinutes: number;
  bufferBetweenSlots: number;
  workingHours: WorkingHoursConfig;
  timezone: string;
  advanceBookingDays: number;
  slotsToOfferInBot: number;
  meetingTitle: string;
  ghlBookingLink: string;
  primaryConsultantUserId?: string;
}

export interface CalendarIntegrationStatus {
  google: { connected: boolean; email: string; lastSyncAt: string | null };
  outlook: { connected: boolean; email: string };
}

export interface CalendarTestSlot {
  index: number;
  startTime: string;
  endTime: string;
  label: string;
  labelShort: string;
}

export interface UpcomingCallRow {
  leadId: string;
  leadName: string;
  scheduledAt: string;
  meetLink: string;
  profileUrl: string;
}

export interface Settings {
  calendlyLink?: string;
  calendlyWebhookSigningKey?: string;
  voiceFallbackDelayMinutes?: number;
  maxVoiceAttempts?: number;
  vaaniAgentId?: string;
  vaaniOutboundNumber?: string;
  thresholds: {
    notReadyBelow: number;
    franchiseReadyMin: number;
    franchiseReadyMax: number;
  };
  alertRules: {
    coldLeadDaysWarning: number;
    coldLeadDaysCritical: number;
    stuckStageDaysWarning: number;
    stuckStageDaysCritical: number;
    proposalNotOpenedDaysInfo: number;
    proposalNotOpenedDaysWarning: number;
  };
  integrations: Integration[];
  waTemplates: WATemplate[];
  emailTemplates: EmailTemplate[];
  availabilitySettings?: AvailabilitySettings;
}
