import type {
  LeadHealth, LeadTemperature, SLAStatus, SLAState,
  LeadLoss, SalesAlert, StageDropoff, LossReasonStat,
  SourceConversion, ResponseTimeConversion, LOSS_REASON_LABELS
} from '@/types/sales';

// ===== Lead Health for each lead =====
export const leadHealthMap: Record<string, LeadHealth> = {
  l1: { leadId: 'l1', temperature: 'warm', riskScore: 35, daysSinceContact: 1, responseRate: 0.8, engagementTrend: 'stable', sla: { firstResponseTime: 2, firstResponseSLA: 120, firstResponseState: 'on_track', lastFollowUpAt: '2024-12-14T08:15:00Z', followUpCadenceDays: 2, followUpState: 'on_track', averageResponseTime: 15 }, alerts: [] },
  l2: { leadId: 'l2', temperature: 'warm', riskScore: 30, daysSinceContact: 1, responseRate: 0.7, engagementTrend: 'stable', sla: { firstResponseTime: 5, firstResponseSLA: 120, firstResponseState: 'on_track', lastFollowUpAt: '2024-12-13T16:00:00Z', followUpCadenceDays: 2, followUpState: 'on_track', averageResponseTime: 20 }, alerts: [] },
  l3: { leadId: 'l3', temperature: 'cold', riskScore: 65, daysSinceContact: 2, responseRate: 0.3, engagementTrend: 'declining', sla: { firstResponseTime: 180, firstResponseSLA: 120, firstResponseState: 'breached', lastFollowUpAt: '2024-12-14T06:30:00Z', followUpCadenceDays: 3, followUpState: 'on_track', averageResponseTime: 60 }, alerts: ['alert_3', 'alert_9'] },
  l4: { leadId: 'l4', temperature: 'warm', riskScore: 40, daysSinceContact: 1, responseRate: 0.6, engagementTrend: 'stable', sla: { firstResponseTime: 30, firstResponseSLA: 120, firstResponseState: 'on_track', lastFollowUpAt: '2024-12-14T05:00:00Z', followUpCadenceDays: 2, followUpState: 'on_track', averageResponseTime: 25 }, alerts: [] },
  l5: { leadId: 'l5', temperature: 'cold', riskScore: 72, daysSinceContact: 4, responseRate: 0.2, engagementTrend: 'declining', sla: { firstResponseTime: 240, firstResponseSLA: 120, firstResponseState: 'breached', lastFollowUpAt: '2024-12-10T14:00:00Z', followUpCadenceDays: 3, followUpState: 'breached', averageResponseTime: 120 }, alerts: ['alert_1', 'alert_5'] },
  l6: { leadId: 'l6', temperature: 'warm', riskScore: 30, daysSinceContact: 1, responseRate: 0.5, engagementTrend: 'stable', sla: { firstResponseTime: 15, firstResponseSLA: 120, firstResponseState: 'on_track', lastFollowUpAt: '2024-12-14T03:00:00Z', followUpCadenceDays: 2, followUpState: 'on_track', averageResponseTime: 20 }, alerts: [] },
  l8: { leadId: 'l8', temperature: 'cold', riskScore: 60, daysSinceContact: 3, responseRate: 0.4, engagementTrend: 'declining', sla: { firstResponseTime: 90, firstResponseSLA: 120, firstResponseState: 'on_track', lastFollowUpAt: '2024-12-12T09:00:00Z', followUpCadenceDays: 2, followUpState: 'breached', averageResponseTime: 45 }, alerts: ['alert_6'] },
  l9: { leadId: 'l9', temperature: 'hot', riskScore: 15, daysSinceContact: 0, responseRate: 0.9, engagementTrend: 'rising', sla: { firstResponseTime: 5, firstResponseSLA: 120, firstResponseState: 'on_track', lastFollowUpAt: '2024-12-14T07:45:00Z', followUpCadenceDays: 2, followUpState: 'on_track', averageResponseTime: 10 }, alerts: [] },
  l10: { leadId: 'l10', temperature: 'cold', riskScore: 68, daysSinceContact: 5, responseRate: 0.3, engagementTrend: 'declining', sla: { firstResponseTime: 300, firstResponseSLA: 120, firstResponseState: 'breached', lastFollowUpAt: '2024-12-09T12:00:00Z', followUpCadenceDays: 3, followUpState: 'breached', averageResponseTime: 90 }, alerts: ['alert_2', 'alert_7'] },
  l11: { leadId: 'l11', temperature: 'hot', riskScore: 10, daysSinceContact: 0, responseRate: 0.95, engagementTrend: 'rising', sla: { firstResponseTime: 3, firstResponseSLA: 120, firstResponseState: 'on_track', lastFollowUpAt: '2024-12-14T07:00:00Z', followUpCadenceDays: 2, followUpState: 'on_track', averageResponseTime: 8 }, alerts: [] },
  l12: { leadId: 'l12', temperature: 'warm', riskScore: 38, daysSinceContact: 1, responseRate: 0.6, engagementTrend: 'stable', sla: { firstResponseTime: 20, firstResponseSLA: 120, firstResponseState: 'on_track', lastFollowUpAt: '2024-12-14T01:00:00Z', followUpCadenceDays: 2, followUpState: 'on_track', averageResponseTime: 18 }, alerts: [] },
  l13: { leadId: 'l13', temperature: 'hot', riskScore: 5, daysSinceContact: 0, responseRate: 1.0, engagementTrend: 'rising', sla: { firstResponseTime: 2, firstResponseSLA: 120, firstResponseState: 'on_track', lastFollowUpAt: '2024-12-14T10:35:00Z', followUpCadenceDays: 2, followUpState: 'on_track', averageResponseTime: 5 }, alerts: [] },
  l15: { leadId: 'l15', temperature: 'warm', riskScore: 42, daysSinceContact: 2, responseRate: 0.5, engagementTrend: 'declining', sla: { firstResponseTime: 45, firstResponseSLA: 120, firstResponseState: 'on_track', lastFollowUpAt: '2024-12-13T22:00:00Z', followUpCadenceDays: 2, followUpState: 'at_risk', averageResponseTime: 30 }, alerts: ['alert_8'] },
  l16: { leadId: 'l16', temperature: 'cold', riskScore: 75, daysSinceContact: 6, responseRate: 0.2, engagementTrend: 'declining', sla: { firstResponseTime: 360, firstResponseSLA: 120, firstResponseState: 'breached', lastFollowUpAt: '2024-12-08T10:00:00Z', followUpCadenceDays: 3, followUpState: 'breached', averageResponseTime: 150 }, alerts: ['alert_4'] },
  l17: { leadId: 'l17', temperature: 'hot', riskScore: 12, daysSinceContact: 0, responseRate: 0.85, engagementTrend: 'rising', sla: { firstResponseTime: 8, firstResponseSLA: 120, firstResponseState: 'on_track', lastFollowUpAt: '2024-12-14T04:00:00Z', followUpCadenceDays: 2, followUpState: 'on_track', averageResponseTime: 12 }, alerts: [] },
  l18: { leadId: 'l18', temperature: 'cold', riskScore: 70, daysSinceContact: 4, responseRate: 0.25, engagementTrend: 'declining', sla: { firstResponseTime: 200, firstResponseSLA: 120, firstResponseState: 'breached', lastFollowUpAt: '2024-12-10T08:00:00Z', followUpCadenceDays: 3, followUpState: 'breached', averageResponseTime: 80 }, alerts: ['alert_10'] },
  l22: { leadId: 'l22', temperature: 'warm', riskScore: 32, daysSinceContact: 1, responseRate: 0.7, engagementTrend: 'stable', sla: { firstResponseTime: 12, firstResponseSLA: 120, firstResponseState: 'on_track', lastFollowUpAt: '2024-12-14T08:30:00Z', followUpCadenceDays: 2, followUpState: 'on_track', averageResponseTime: 15 }, alerts: [] },
  l23: { leadId: 'l23', temperature: 'dead', riskScore: 95, daysSinceContact: 12, responseRate: 0.1, engagementTrend: 'declining', sla: { firstResponseTime: 480, firstResponseSLA: 120, firstResponseState: 'breached', lastFollowUpAt: '2024-12-02T10:00:00Z', followUpCadenceDays: 3, followUpState: 'breached', averageResponseTime: 200 }, alerts: [] },
  l24: { leadId: 'l24', temperature: 'warm', riskScore: 28, daysSinceContact: 1, responseRate: 0.75, engagementTrend: 'stable', sla: { firstResponseTime: 10, firstResponseSLA: 120, firstResponseState: 'on_track', lastFollowUpAt: '2024-12-13T12:00:00Z', followUpCadenceDays: 2, followUpState: 'on_track', averageResponseTime: 14 }, alerts: [] },
  l25: { leadId: 'l25', temperature: 'hot', riskScore: 8, daysSinceContact: 0, responseRate: 1.0, engagementTrend: 'rising', sla: { firstResponseTime: 3, firstResponseSLA: 120, firstResponseState: 'on_track', lastFollowUpAt: '2024-12-14T09:15:00Z', followUpCadenceDays: 2, followUpState: 'on_track', averageResponseTime: 6 }, alerts: [] },
};

// ===== Lost Leads =====
export const lostLeads: LeadLoss[] = [
  { leadId: 'l23', leadName: 'Prakash Jain', reason: 'changed_mind', reasonLabel: 'Changed Mind', lostAtStage: 'Convert to Consulting', lostAtTrack: 'Not Ready', notes: 'Lost interest after 2 weeks without follow-up', lostDate: '2024-12-01', daysInPipeline: 15, score: 18 },
  { leadId: 'lost_1', leadName: 'Anil Khanna', reason: 'not_enough_capital', reasonLabel: 'Not Enough Capital', lostAtStage: 'Discovery Call', lostAtTrack: 'Not Ready', notes: 'Only has 5L, needs minimum 15L', lostDate: '2024-12-05', daysInPipeline: 8, score: 22 },
  { leadId: 'lost_2', leadName: 'Priya Mishra', reason: 'chose_competitor', reasonLabel: 'Chose Competitor', lostAtStage: 'Proposal Sent', lostAtTrack: 'Franchise Ready', competitorName: 'FranConnect India', notes: 'Went with cheaper competitor offering', lostDate: '2024-12-03', daysInPipeline: 21, score: 72 },
  { leadId: 'lost_3', leadName: 'Gaurav Sinha', reason: 'no_response', reasonLabel: 'No Response / Ghosted', lostAtStage: 'Reminders Sent', lostAtTrack: 'Franchise Ready', notes: 'No response after 5 follow-ups over 3 weeks', lostDate: '2024-12-08', daysInPipeline: 18, score: 65 },
  { leadId: 'lost_4', leadName: 'Sneha Kulkarni', reason: 'bad_timing', reasonLabel: 'Bad Timing', lostAtStage: 'Discovery Booked', lostAtTrack: 'Franchise Ready', notes: 'Planning to start in 2026, too early', lostDate: '2024-11-28', daysInPipeline: 12, score: 58 },
  { leadId: 'lost_5', leadName: 'Ramesh Yadav', reason: 'location_mismatch', reasonLabel: 'Location Mismatch', lostAtStage: 'Discovery Call', lostAtTrack: 'Not Ready', notes: 'Wants franchise in Tier-3 city, no brands available', lostDate: '2024-12-10', daysInPipeline: 5, score: 35 },
  { leadId: 'lost_6', leadName: 'Kavya Reddy', reason: 'price_too_high', reasonLabel: 'Price Too High', lostAtStage: 'Proposal Sent', lostAtTrack: 'Franchise Ready', notes: 'Consulting fees too high, wants to DIY', lostDate: '2024-12-06', daysInPipeline: 14, score: 68 },
  { leadId: 'lost_7', leadName: 'Mohit Agrawal', reason: 'not_serious', reasonLabel: 'Not Serious Buyer', lostAtStage: 'Gap Nurture', lostAtTrack: 'Not Ready', notes: 'Just browsing, no real intent', lostDate: '2024-12-11', daysInPipeline: 3, score: 15 },
  { leadId: 'lost_8', leadName: 'Deepa Nair', reason: 'no_response', reasonLabel: 'No Response / Ghosted', lostAtStage: 'Discovery Booked', lostAtTrack: 'Franchise Ready', notes: 'No-show on call, no response to follow-ups', lostDate: '2024-12-09', daysInPipeline: 10, score: 55 },
];

// ===== Alerts =====
export const salesAlerts: SalesAlert[] = [
  { id: 'alert_1', leadId: 'l5', leadName: 'Suresh Reddy', category: 'lead_cold', priority: 'critical', title: 'Lead Gone Cold', description: 'No contact for 4 days. Suresh was in "Not Early" stage — high risk of permanent loss.', createdAt: '2024-12-14T08:00:00Z', dismissed: false, actionLabel: 'Send WhatsApp', actionType: 'send_wa' },
  { id: 'alert_2', leadId: 'l10', leadName: 'Neha Gupta', category: 'lead_cold', priority: 'critical', title: 'Lead Gone Cold', description: 'No contact for 5 days. Score 38 — Convert to Consulting stage. Needs immediate re-engagement.', createdAt: '2024-12-14T07:00:00Z', dismissed: false, actionLabel: 'Send WhatsApp', actionType: 'send_wa' },
  { id: 'alert_3', leadId: 'l3', leadName: 'Rajesh Kumar', category: 'sla_breach', priority: 'critical', title: 'SLA Breach — First Response', description: 'First response took 3 hrs (SLA: 2 hrs). Lead from Meta Ad — fast response critical for ad ROI.', createdAt: '2024-12-14T06:00:00Z', dismissed: false, actionLabel: 'View Lead', actionType: 'view_lead' },
  { id: 'alert_4', leadId: 'l16', leadName: 'Ritu Saxena', category: 'stage_stuck', priority: 'warning', title: 'Stuck in Stage (10 days)', description: 'Ritu has been in "Not Early" for 10 days. Average for this stage is 5 days. Pipeline is stalling.', createdAt: '2024-12-14T06:00:00Z', dismissed: false, actionLabel: 'Book Call', actionType: 'book_call' },
  { id: 'alert_5', leadId: 'l5', leadName: 'Suresh Reddy', category: 'followup_overdue', priority: 'warning', title: 'Follow-up Overdue', description: 'Last follow-up was 4 days ago. SLA requires contact every 3 days for nurture leads.', createdAt: '2024-12-14T05:00:00Z', dismissed: false, actionLabel: 'Send WhatsApp', actionType: 'send_wa' },
  { id: 'alert_6', leadId: 'l8', leadName: 'Divya Menon', category: 'noshow_no_reengagement', priority: 'warning', title: 'No-Show — No Re-engagement', description: 'Divya was a no-show on Dec 12. Follow-up sent but no response. Rebook or send personal WA.', createdAt: '2024-12-14T04:00:00Z', dismissed: false, actionLabel: 'Book Call', actionType: 'book_call' },
  { id: 'alert_7', leadId: 'l10', leadName: 'Neha Gupta', category: 'followup_overdue', priority: 'warning', title: 'Follow-up Overdue', description: 'No follow-up in 5 days. Neha is in Convert to Consulting — needs attention before she drops.', createdAt: '2024-12-14T03:00:00Z', dismissed: false, actionLabel: 'Add Note', actionType: 'add_note' },
  { id: 'alert_8', leadId: 'l15', leadName: 'Deepak Choudhary', category: 'proposal_not_opened', priority: 'info', title: 'Proposal Not Opened (48h)', description: 'Proposal sent 3 days ago, opened but not signed. Follow up to close.', createdAt: '2024-12-13T22:00:00Z', dismissed: false, actionLabel: 'Send WhatsApp', actionType: 'send_wa' },
  { id: 'alert_9', leadId: 'l3', leadName: 'Rajesh Kumar', category: 'lead_going_cold', priority: 'info', title: 'Engagement Declining', description: 'Response rate dropping. Last 2 messages had no reply. Consider a personal call.', createdAt: '2024-12-14T02:00:00Z', dismissed: false, actionLabel: 'Book Call', actionType: 'book_call' },
  { id: 'alert_10', leadId: 'l18', leadName: 'Swati Kapoor', category: 'stage_stuck', priority: 'warning', title: 'Stuck in Stage (4 days)', description: 'Swati in Gap Nurture for 4 days with declining engagement. Low commitment score.', createdAt: '2024-12-14T01:00:00Z', dismissed: false, actionLabel: 'Send WhatsApp', actionType: 'send_wa' },
  { id: 'alert_11', leadId: 'l13', leadName: 'Sanjay Bhat', category: 'high_score_lead', priority: 'info', title: 'New Lead — Meta Ad', description: 'New lead from "Gap Nurture Retargeting" campaign. Score: 22. Auto-enrolled in nurture sequence.', createdAt: '2024-12-14T10:30:00Z', dismissed: false, actionLabel: 'View Lead', actionType: 'view_lead' },
  { id: 'alert_12', leadId: 'l11', leadName: 'Rohit Agarwal', category: 'high_score_lead', priority: 'info', title: 'Hot Lead — Discovery Booked', description: 'Score 74, restaurant background, discovery call tomorrow. Prepare for high-value conversion.', createdAt: '2024-12-14T07:00:00Z', dismissed: true, actionLabel: 'View Lead', actionType: 'view_lead' },
];

// ===== Analytics Data =====
export const stageDropoffs: StageDropoff[] = [
  { stage: 'Lead In', entered: 120, exited: 95, lost: 25, avgDaysInStage: 1, conversionRate: 79 },
  { stage: 'Scored & Routed', entered: 95, exited: 78, lost: 17, avgDaysInStage: 1, conversionRate: 82 },
  { stage: 'Nurture / Discovery', entered: 78, exited: 52, lost: 26, avgDaysInStage: 5, conversionRate: 67 },
  { stage: 'Discovery Done', entered: 52, exited: 38, lost: 14, avgDaysInStage: 3, conversionRate: 73 },
  { stage: 'Proposal Sent', entered: 38, exited: 22, lost: 16, avgDaysInStage: 4, conversionRate: 58 },
  { stage: 'Signed', entered: 22, exited: 22, lost: 0, avgDaysInStage: 2, conversionRate: 100 },
];

export const lossReasonStats: LossReasonStat[] = [
  { reason: 'no_response', label: 'No Response / Ghosted', count: 32, percentage: 28 },
  { reason: 'not_enough_capital', label: 'Not Enough Capital', count: 22, percentage: 19 },
  { reason: 'bad_timing', label: 'Bad Timing', count: 18, percentage: 16 },
  { reason: 'chose_competitor', label: 'Chose Competitor', count: 14, percentage: 12 },
  { reason: 'price_too_high', label: 'Price Too High', count: 10, percentage: 9 },
  { reason: 'not_serious', label: 'Not Serious Buyer', count: 8, percentage: 7 },
  { reason: 'location_mismatch', label: 'Location Mismatch', count: 6, percentage: 5 },
  { reason: 'changed_mind', label: 'Changed Mind', count: 5, percentage: 4 },
];

export const sourceConversions: SourceConversion[] = [
  { source: 'Meta Ad', leads: 65, signed: 8, conversionRate: 12.3, avgScore: 48, avgCPL: 145 },
  { source: 'WhatsApp Inbound', leads: 28, signed: 5, conversionRate: 17.9, avgScore: 62, avgCPL: 0 },
  { source: 'Referral', leads: 18, signed: 6, conversionRate: 33.3, avgScore: 71, avgCPL: 0 },
  { source: 'Direct', leads: 9, signed: 3, conversionRate: 33.3, avgScore: 55, avgCPL: 0 },
];

export const responseTimeConversions: ResponseTimeConversion[] = [
  { bucket: '< 30 min', leads: 35, converted: 12, conversionRate: 34.3 },
  { bucket: '30m - 1 hr', leads: 28, converted: 7, conversionRate: 25.0 },
  { bucket: '1 - 2 hrs', leads: 22, converted: 3, conversionRate: 13.6 },
  { bucket: '2 - 4 hrs', leads: 18, converted: 1, conversionRate: 5.6 },
  { bucket: '4+ hrs', leads: 17, converted: 0, conversionRate: 0 },
];

// Helper
export function getLeadHealth(leadId: string): LeadHealth | undefined {
  return leadHealthMap[leadId];
}
