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
  actionType?:
    | 'send_wa'
    | 'book_call'
    | 'add_note'
    | 'view_lead'
    | 'send_proposal';
}
