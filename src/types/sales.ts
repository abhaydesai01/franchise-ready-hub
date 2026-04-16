import type { Lead } from '@/types';

// ===== Lead Health (Temperature) =====
export type LeadTemperature = 'hot' | 'warm' | 'cold' | 'dead';

export interface LeadHealth {
  leadId: string;
  temperature: LeadTemperature;
  riskScore: number; // 0-100, higher = more at risk
  daysSinceContact: number;
  responseRate: number; // 0-1
  engagementTrend: 'rising' | 'stable' | 'declining';
  sla: SLAStatus;
  alerts: string[]; // active alert IDs
}

// ===== SLA =====
export type SLAState = 'on_track' | 'at_risk' | 'breached';

export interface SLAStatus {
  firstResponseTime: number | null; // minutes, null = not responded yet
  firstResponseSLA: number; // target in minutes (e.g. 120 = 2 hrs)
  firstResponseState: SLAState;
  lastFollowUpAt: string | null;
  followUpCadenceDays: number; // e.g. 2 = must follow up every 2 days
  followUpState: SLAState;
  averageResponseTime: number; // minutes
}

// ===== Lead Loss =====
export type LossReason =
  | 'not_enough_capital'
  | 'bad_timing'
  | 'chose_competitor'
  | 'no_response'
  | 'location_mismatch'
  | 'changed_mind'
  | 'price_too_high'
  | 'not_serious'
  | 'other';

export interface LeadLoss {
  leadId: string;
  leadName: string;
  reason: LossReason;
  reasonLabel: string;
  lostAtStage: string;
  lostAtTrack: string;
  competitorName?: string;
  notes?: string;
  lostDate: string;
  daysInPipeline: number;
  score: number;
}

// ===== Alerts =====
export type AlertPriority = 'critical' | 'warning' | 'info';
export type AlertCategory =
  | 'lead_cold'
  | 'sla_breach'
  | 'followup_overdue'
  | 'stage_stuck'
  | 'noshow_no_reengagement'
  | 'proposal_not_opened'
  | 'sequence_failed'
  | 'high_score_lead'
  | 'lead_going_cold'
  | 'response_time_slow';

export interface SalesAlert {
  id: string;
  leadId: string;
  leadName: string;
  category: AlertCategory;
  priority: AlertPriority;
  title: string;
  description: string;
  createdAt: string;
  dismissed: boolean;
  actionLabel?: string;
  actionType?: 'send_wa' | 'book_call' | 'add_note' | 'view_lead' | 'send_proposal';
}

// ===== Stage Drop-off Analytics =====
export interface StageDropoff {
  stage: string;
  entered: number;
  exited: number;
  lost: number;
  avgDaysInStage: number;
  conversionRate: number;
}

export interface LossReasonStat {
  reason: LossReason;
  label: string;
  count: number;
  percentage: number;
}

export interface SourceConversion {
  source: string;
  leads: number;
  signed: number;
  conversionRate: number;
  avgScore: number;
  avgCPL: number;
}

export interface ResponseTimeConversion {
  bucket: string; // e.g. "< 1 hr", "1-2 hrs", etc.
  leads: number;
  converted: number;
  conversionRate: number;
}

export const LOSS_REASON_LABELS: Record<LossReason, string> = {
  not_enough_capital: 'Not Enough Capital',
  bad_timing: 'Bad Timing',
  chose_competitor: 'Chose Competitor',
  no_response: 'No Response / Ghosted',
  location_mismatch: 'Location Mismatch',
  changed_mind: 'Changed Mind',
  price_too_high: 'Price Too High',
  not_serious: 'Not Serious Buyer',
  other: 'Other',
};

// ===== Re-engagement Triggers =====
export type ReEngagementTrigger = 'lead_cold' | 'no_response_3d' | 'no_response_5d' | 'sla_breach' | 'stage_stuck' | 'noshow' | 'proposal_not_opened';

export type ReEngagementAction = 'send_wa_template' | 'schedule_call' | 'send_email' | 'assign_to_senior';

export interface ReEngagementRule {
  id: string;
  name: string;
  trigger: ReEngagementTrigger;
  triggerLabel: string;
  conditions: {
    daysSinceContact?: number;
    temperature?: LeadTemperature;
    minScore?: number;
    maxScore?: number;
    tracks?: string[];
    stages?: string[];
  };
  actions: {
    type: ReEngagementAction;
    label: string;
    templateName?: string;
    delay?: number;
    delayUnit?: 'minutes' | 'hours' | 'days';
  }[];
  enabled: boolean;
  totalTriggered: number;
  successRate: number; // 0-100
  lastTriggered: string | null;
  createdAt: string;
}

export interface ReEngagementLog {
  id: string;
  ruleId: string;
  ruleName: string;
  leadId: string;
  leadName: string;
  trigger: ReEngagementTrigger;
  actionsExecuted: { type: ReEngagementAction; label: string; status: 'success' | 'failed' | 'pending' }[];
  outcome: 'responded' | 'no_response' | 'pending' | 'converted';
  triggeredAt: string;
}
