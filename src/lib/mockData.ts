import type {
  Lead, Activity, DiscoveryCall, Proposal, AutomationSequence,
  AutomationLog, Client, Notification, TeamMember, DashboardStats,
  Settings, Track, Stage, Source, ScoreDimension
} from '@/types';

const team: TeamMember[] = [
  { id: 't1', name: 'Arjun Mehta', email: 'arjun@franchise-ready.in', role: 'Admin', avatarInitials: 'AM', addedDate: '2024-01-15' },
  { id: 't2', name: 'Priya Sharma', email: 'priya@franchise-ready.in', role: 'Consultant', avatarInitials: 'PS', addedDate: '2024-02-01' },
  { id: 't3', name: 'Rahul Verma', email: 'rahul@franchise-ready.in', role: 'Consultant', avatarInitials: 'RV', addedDate: '2024-03-10' },
  { id: 't4', name: 'Sneha Patel', email: 'sneha@franchise-ready.in', role: 'Manager', avatarInitials: 'SP', addedDate: '2024-04-01' },
];

function makeDimensions(total: number): ScoreDimension[] {
  const base = Math.floor(total / 5);
  const rem = total - base * 5;
  return [
    { name: 'Capital', score: Math.min(base + (rem > 0 ? 2 : 0), 25), max: 25 },
    { name: 'Experience', score: Math.min(base + (rem > 1 ? 1 : 0), 25), max: 25 },
    { name: 'Location', score: Math.min(base, 20), max: 20 },
    { name: 'Commitment', score: Math.min(base + (rem > 2 ? 1 : 0), 15), max: 15 },
    { name: 'Timeline', score: Math.min(base + (rem > 3 ? 1 : 0), 15), max: 15 },
  ];
}

const sources: Source[] = ['Meta Ad', 'WhatsApp Inbound', 'Referral', 'Direct', 'Other'];
const activityTypes = ['WA sent', 'Email opened', 'Call booked', 'Note added', 'Stage changed'] as const;

const leadData: Omit<Lead, 'scoreDimensions'>[] = [
  { id: 'l1', name: 'Vikram Singh', phone: '+919876543210', email: 'vikram@gmail.com', source: 'Meta Ad', track: 'Franchise Ready', stage: 'Discovery Booked', status: 'Active', score: 78, assignedTo: 't2', notes: 'Interested in QSR franchise', createdAt: '2024-12-01', lastActivity: '2h ago', lastActivityType: 'WA sent', stageDuration: 3 },
  { id: 'l2', name: 'Anita Desai', phone: '+919876543211', email: 'anita.d@gmail.com', source: 'Referral', track: 'Franchise Ready', stage: 'Proposal Sent', status: 'Active', score: 85, assignedTo: 't3', notes: 'High capital, experienced', createdAt: '2024-11-15', lastActivity: '1d ago', lastActivityType: 'Proposal sent', stageDuration: 7 },
  { id: 'l3', name: 'Rajesh Kumar', phone: '+919876543212', email: 'rajesh.k@yahoo.com', source: 'Meta Ad', track: 'Not Ready', stage: 'Gap Nurture', status: 'Nurture', score: 32, assignedTo: 't2', notes: 'Needs more capital', createdAt: '2024-12-10', lastActivity: '3h ago', lastActivityType: 'WA sent', stageDuration: 5 },
  { id: 'l4', name: 'Meera Joshi', phone: '+919876543213', email: 'meera.j@outlook.com', source: 'WhatsApp Inbound', track: 'Franchise Ready', stage: 'Reminders Sent', status: 'Active', score: 72, assignedTo: 't3', notes: 'Follow up on Tuesday', createdAt: '2024-12-05', lastActivity: '5h ago', lastActivityType: 'Email opened', stageDuration: 2 },
  { id: 'l5', name: 'Suresh Reddy', phone: '+919876543214', email: 'suresh.r@gmail.com', source: 'Direct', track: 'Not Ready', stage: 'Not Early', status: 'Nurture', score: 28, assignedTo: 't2', notes: 'Timeline too far', createdAt: '2024-12-08', lastActivity: '1d ago', lastActivityType: 'Stage changed', stageDuration: 8 },
  { id: 'l6', name: 'Kavita Nair', phone: '+919876543215', email: 'kavita.n@gmail.com', source: 'Meta Ad', track: 'Recruitment Only', stage: 'Routed to Eden', status: 'Active', score: 45, assignedTo: 't4', notes: 'Routed to Eden team', createdAt: '2024-12-03', lastActivity: '4h ago', lastActivityType: 'WA sent', stageDuration: 4 },
  { id: 'l7', name: 'Amit Patel', phone: '+919876543216', email: 'amit.p@gmail.com', source: 'Referral', track: 'Franchise Ready', stage: 'Signed', status: 'Signed', score: 92, assignedTo: 't2', notes: 'Signed for Franchise Ready program', createdAt: '2024-11-01', lastActivity: '3d ago', lastActivityType: 'Client signed', stageDuration: 0 },
  { id: 'l8', name: 'Divya Menon', phone: '+919876543217', email: 'divya.m@gmail.com', source: 'Meta Ad', track: 'Not Ready', stage: 'Discovery Call', status: 'Scoring', score: 41, assignedTo: 't3', notes: 'Needs discovery call', createdAt: '2024-12-12', lastActivity: '6h ago', lastActivityType: 'Call booked', stageDuration: 1 },
  { id: 'l9', name: 'Karan Malhotra', phone: '+919876543218', email: 'karan.m@hotmail.com', source: 'WhatsApp Inbound', track: 'Franchise Ready', stage: 'Discovery Booked', status: 'Active', score: 67, assignedTo: 't2', notes: 'Good capital, limited experience', createdAt: '2024-12-06', lastActivity: '1h ago', lastActivityType: 'WA sent', stageDuration: 2 },
  { id: 'l10', name: 'Neha Gupta', phone: '+919876543219', email: 'neha.g@gmail.com', source: 'Meta Ad', track: 'Not Ready', stage: 'Convert to Consulting', status: 'Nurture', score: 38, assignedTo: 't4', notes: 'Interested but not ready', createdAt: '2024-12-09', lastActivity: '2d ago', lastActivityType: 'Email opened', stageDuration: 6 },
  { id: 'l11', name: 'Rohit Agarwal', phone: '+919876543220', email: 'rohit.a@gmail.com', source: 'Direct', track: 'Franchise Ready', stage: 'Discovery Booked', status: 'Active', score: 74, assignedTo: 't3', notes: 'Restaurant background', createdAt: '2024-12-11', lastActivity: '30m ago', lastActivityType: 'Call booked', stageDuration: 1 },
  { id: 'l12', name: 'Pooja Iyer', phone: '+919876543221', email: 'pooja.i@gmail.com', source: 'Referral', track: 'Franchise Ready', stage: 'Reminders Sent', status: 'Active', score: 69, assignedTo: 't2', notes: 'Referred by Amit', createdAt: '2024-12-04', lastActivity: '8h ago', lastActivityType: 'WA sent', stageDuration: 3 },
  { id: 'l13', name: 'Sanjay Bhat', phone: '+919876543222', email: 'sanjay.b@gmail.com', source: 'Meta Ad', track: 'Not Ready', stage: 'Gap Nurture', status: 'New', score: 22, assignedTo: 't4', notes: 'Just signed up', createdAt: '2024-12-14', lastActivity: '10m ago', lastActivityType: 'Lead added', stageDuration: 0 },
  { id: 'l14', name: 'Lakshmi Rao', phone: '+919876543223', email: 'lakshmi.r@gmail.com', source: 'Meta Ad', track: 'Recruitment Only', stage: 'Routed to Eden', status: 'Active', score: 55, assignedTo: 't4', notes: 'Eden process started', createdAt: '2024-12-07', lastActivity: '1d ago', lastActivityType: 'Stage changed', stageDuration: 5 },
  { id: 'l15', name: 'Deepak Choudhary', phone: '+919876543224', email: 'deepak.c@gmail.com', source: 'WhatsApp Inbound', track: 'Franchise Ready', stage: 'Proposal Sent', status: 'Active', score: 81, assignedTo: 't2', notes: 'Proposal under review', createdAt: '2024-11-20', lastActivity: '12h ago', lastActivityType: 'Email opened', stageDuration: 4 },
  { id: 'l16', name: 'Ritu Saxena', phone: '+919876543225', email: 'ritu.s@gmail.com', source: 'Referral', track: 'Not Ready', stage: 'Not Early', status: 'Nurture', score: 35, assignedTo: 't3', notes: 'Location concern', createdAt: '2024-12-02', lastActivity: '2d ago', lastActivityType: 'WA sent', stageDuration: 10 },
  { id: 'l17', name: 'Manoj Tiwari', phone: '+919876543226', email: 'manoj.t@gmail.com', source: 'Meta Ad', track: 'Franchise Ready', stage: 'Discovery Booked', status: 'Active', score: 71, assignedTo: 't3', notes: 'Retail experience', createdAt: '2024-12-13', lastActivity: '4h ago', lastActivityType: 'Call booked', stageDuration: 1 },
  { id: 'l18', name: 'Swati Kapoor', phone: '+919876543227', email: 'swati.k@gmail.com', source: 'Direct', track: 'Not Ready', stage: 'Gap Nurture', status: 'Nurture', score: 29, assignedTo: 't2', notes: 'Low commitment score', createdAt: '2024-12-10', lastActivity: '1d ago', lastActivityType: 'WA sent', stageDuration: 4 },
  { id: 'l19', name: 'Vishal Sharma', phone: '+919876543228', email: 'vishal.s@gmail.com', source: 'Meta Ad', track: 'Franchise Ready', stage: 'Signed', status: 'Signed', score: 95, assignedTo: 't2', notes: 'Top scorer, signed quickly', createdAt: '2024-10-20', lastActivity: '1w ago', lastActivityType: 'Client signed', stageDuration: 0 },
  { id: 'l20', name: 'Geeta Pandey', phone: '+919876543229', email: 'geeta.p@gmail.com', source: 'WhatsApp Inbound', track: 'Not Ready', stage: 'Discovery Call', status: 'Scoring', score: 44, assignedTo: 't3', notes: 'Needs assessment', createdAt: '2024-12-11', lastActivity: '3h ago', lastActivityType: 'Call booked', stageDuration: 2 },
  { id: 'l21', name: 'Ashok Mishra', phone: '+919876543230', email: 'ashok.m@gmail.com', source: 'Meta Ad', track: 'Recruitment Only', stage: 'Routed to Eden', status: 'Active', score: 50, assignedTo: 't4', notes: 'Recruitment track', createdAt: '2024-12-08', lastActivity: '6h ago', lastActivityType: 'WA sent', stageDuration: 3 },
  { id: 'l22', name: 'Nandini Das', phone: '+919876543231', email: 'nandini.d@gmail.com', source: 'Referral', track: 'Franchise Ready', stage: 'Reminders Sent', status: 'Active', score: 76, assignedTo: 't2', notes: 'Strong profile', createdAt: '2024-12-05', lastActivity: '2h ago', lastActivityType: 'Email opened', stageDuration: 3 },
  { id: 'l23', name: 'Prakash Jain', phone: '+919876543232', email: 'prakash.j@gmail.com', source: 'Meta Ad', track: 'Not Ready', stage: 'Convert to Consulting', status: 'Dead', score: 18, assignedTo: 't4', notes: 'Not interested anymore', createdAt: '2024-11-25', lastActivity: '5d ago', lastActivityType: 'Stage changed', stageDuration: 15 },
  { id: 'l24', name: 'Sunita Bhatt', phone: '+919876543233', email: 'sunita.b@gmail.com', source: 'Direct', track: 'Franchise Ready', stage: 'Proposal Sent', status: 'Active', score: 88, assignedTo: 't3', notes: 'Excellent candidate', createdAt: '2024-11-18', lastActivity: '1d ago', lastActivityType: 'Proposal sent', stageDuration: 5 },
  { id: 'l25', name: 'Harish Goel', phone: '+919876543234', email: 'harish.g@gmail.com', source: 'Meta Ad', track: 'Not Ready', stage: 'Gap Nurture', status: 'New', score: 25, assignedTo: 't2', notes: 'New lead from ad', createdAt: '2024-12-14', lastActivity: '1h ago', lastActivityType: 'Lead added', stageDuration: 0 },
];

export const leads: Lead[] = leadData.map(l => ({
  ...l,
  scoreDimensions: makeDimensions(l.score),
}));

export const activities: Activity[] = [
  { id: 'a1', leadId: 'l13', leadName: 'Sanjay Bhat', type: 'lead_added', description: 'New lead added from Meta Ad', timestamp: '2024-12-14T10:30:00Z', addedBy: 't4' },
  { id: 'a2', leadId: 'l25', leadName: 'Harish Goel', type: 'lead_added', description: 'New lead added from Meta Ad', timestamp: '2024-12-14T09:15:00Z', addedBy: 't2' },
  { id: 'a3', leadId: 'l1', leadName: 'Vikram Singh', type: 'wa_sent', description: 'WhatsApp message sent to Vikram Singh', timestamp: '2024-12-14T08:00:00Z' },
  { id: 'a4', leadId: 'l9', leadName: 'Karan Malhotra', type: 'wa_sent', description: 'Follow-up WhatsApp sent', timestamp: '2024-12-14T07:30:00Z' },
  { id: 'a5', leadId: 'l11', leadName: 'Rohit Agarwal', type: 'call_booked', description: 'Discovery call booked for Dec 16', timestamp: '2024-12-14T07:00:00Z' },
  { id: 'a6', leadId: 'l4', leadName: 'Meera Joshi', type: 'email_opened', description: 'Meera opened proposal email', timestamp: '2024-12-14T05:00:00Z' },
  { id: 'a7', leadId: 'l2', leadName: 'Anita Desai', type: 'proposal_sent', description: 'Proposal sent to Anita Desai', timestamp: '2024-12-13T16:00:00Z' },
  { id: 'a8', leadId: 'l5', leadName: 'Suresh Reddy', type: 'stage_changed', description: 'Moved to Not Early stage', timestamp: '2024-12-13T14:00:00Z' },
  { id: 'a9', leadId: 'l7', leadName: 'Amit Patel', type: 'client_signed', description: 'Amit Patel signed Franchise Ready program!', timestamp: '2024-12-11T10:00:00Z' },
  { id: 'a10', leadId: 'l3', leadName: 'Rajesh Kumar', type: 'wa_sent', description: 'Nurture sequence WA sent', timestamp: '2024-12-14T06:30:00Z' },
  { id: 'a11', leadId: 'l8', leadName: 'Divya Menon', type: 'call_booked', description: 'Discovery call booked', timestamp: '2024-12-14T06:00:00Z' },
  { id: 'a12', leadId: 'l15', leadName: 'Deepak Choudhary', type: 'email_opened', description: 'Proposal email opened', timestamp: '2024-12-13T22:00:00Z' },
  { id: 'a13', leadId: 'l22', leadName: 'Nandini Das', type: 'email_opened', description: 'Follow-up email opened', timestamp: '2024-12-14T08:30:00Z' },
  { id: 'a14', leadId: 'l17', leadName: 'Manoj Tiwari', type: 'call_booked', description: 'Discovery call booked for Dec 17', timestamp: '2024-12-14T04:00:00Z' },
  { id: 'a15', leadId: 'l6', leadName: 'Kavita Nair', type: 'wa_sent', description: 'WA routing confirmation sent', timestamp: '2024-12-14T03:00:00Z' },
  { id: 'a16', leadId: 'l19', leadName: 'Vishal Sharma', type: 'client_signed', description: 'Vishal Sharma signed!', timestamp: '2024-12-07T10:00:00Z' },
  { id: 'a17', leadId: 'l24', leadName: 'Sunita Bhatt', type: 'proposal_sent', description: 'Proposal sent to Sunita', timestamp: '2024-12-13T12:00:00Z' },
  { id: 'a18', leadId: 'l20', leadName: 'Geeta Pandey', type: 'call_booked', description: 'Discovery call scheduled', timestamp: '2024-12-14T02:00:00Z' },
  { id: 'a19', leadId: 'l14', leadName: 'Lakshmi Rao', type: 'stage_changed', description: 'Routed to Eden', timestamp: '2024-12-13T10:00:00Z' },
  { id: 'a20', leadId: 'l12', leadName: 'Pooja Iyer', type: 'wa_sent', description: 'Reminder WA sent', timestamp: '2024-12-14T01:00:00Z' },
];

export const calls: DiscoveryCall[] = [
  { id: 'c1', leadId: 'l11', leadName: 'Rohit Agarwal', track: 'Franchise Ready', score: 74, scheduledAt: '2024-12-16T10:00:00Z', status: 'upcoming', notes: '', proposalGenerated: false, consultantName: 'Rahul Verma', calcomLink: 'https://cal.com/franchise-ready/rohit' },
  { id: 'c2', leadId: 'l17', leadName: 'Manoj Tiwari', track: 'Franchise Ready', score: 71, scheduledAt: '2024-12-17T14:00:00Z', status: 'upcoming', notes: '', proposalGenerated: false, consultantName: 'Rahul Verma', calcomLink: 'https://cal.com/franchise-ready/manoj' },
  { id: 'c3', leadId: 'l9', leadName: 'Karan Malhotra', track: 'Franchise Ready', score: 67, scheduledAt: '2024-12-16T11:30:00Z', status: 'upcoming', notes: '', proposalGenerated: false, consultantName: 'Priya Sharma', calcomLink: 'https://cal.com/franchise-ready/karan' },
  { id: 'c4', leadId: 'l2', leadName: 'Anita Desai', track: 'Franchise Ready', score: 85, scheduledAt: '2024-12-10T10:00:00Z', status: 'completed', notes: 'Very strong candidate. Has 15 years of retail experience and 50L capital ready. Wants to explore QSR brands in Bangalore.', proposalGenerated: true, consultantName: 'Rahul Verma', calcomLink: '' },
  { id: 'c5', leadId: 'l15', leadName: 'Deepak Choudhary', track: 'Franchise Ready', score: 81, scheduledAt: '2024-12-08T14:00:00Z', status: 'completed', notes: 'Interested in education franchise. Budget 30-40L. Location preference: Delhi NCR.', proposalGenerated: true, consultantName: 'Priya Sharma', calcomLink: '' },
  { id: 'c6', leadId: 'l8', leadName: 'Divya Menon', track: 'Not Ready', score: 41, scheduledAt: '2024-12-12T09:00:00Z', status: 'noshow', notes: '', proposalGenerated: false, consultantName: 'Rahul Verma', calcomLink: 'https://cal.com/franchise-ready/divya', followUpSent: true },
  { id: 'c7', leadId: 'l20', leadName: 'Geeta Pandey', track: 'Not Ready', score: 44, scheduledAt: '2024-12-13T16:00:00Z', status: 'noshow', notes: '', proposalGenerated: false, consultantName: 'Priya Sharma', calcomLink: 'https://cal.com/franchise-ready/geeta', followUpSent: false },
];

export const proposals: Proposal[] = [
  { id: 'p1', leadId: 'l2', leadName: 'Anita Desai', track: 'Franchise Ready', program: 'Franchise Ready', status: 'Sent', content: '<h2>Franchise Ready Program — Anita Desai</h2><p>Based on your discovery call, we recommend the 3-month Franchise Ready program...</p>', createdAt: '2024-12-11', sentAt: '2024-12-13', openedAt: null, signedAt: null },
  { id: 'p2', leadId: 'l15', leadName: 'Deepak Choudhary', track: 'Franchise Ready', program: 'Franchise Launch', status: 'Opened', content: '<h2>Franchise Launch Program — Deepak Choudhary</h2><p>Given your interest in the education sector...</p>', createdAt: '2024-12-09', sentAt: '2024-12-10', openedAt: '2024-12-13', signedAt: null },
  { id: 'p3', leadId: 'l24', leadName: 'Sunita Bhatt', track: 'Franchise Ready', program: 'Franchise Ready', status: 'Sent', content: '<h2>Franchise Ready Program — Sunita Bhatt</h2><p>Your strong profile makes you an ideal candidate...</p>', createdAt: '2024-12-12', sentAt: '2024-12-13', openedAt: null, signedAt: null },
  { id: 'p4', leadId: 'l7', leadName: 'Amit Patel', track: 'Franchise Ready', program: 'Franchise Ready', status: 'Signed', content: '<h2>Franchise Ready Program — Amit Patel</h2><p>Welcome to the program...</p>', createdAt: '2024-11-05', sentAt: '2024-11-06', openedAt: '2024-11-06', signedAt: '2024-11-10' },
  { id: 'p5', leadId: 'l19', leadName: 'Vishal Sharma', track: 'Franchise Ready', program: 'Franchise Performance', status: 'Signed', content: '<h2>Franchise Performance Program — Vishal Sharma</h2><p>Premium 12-month program...</p>', createdAt: '2024-10-22', sentAt: '2024-10-23', openedAt: '2024-10-23', signedAt: '2024-10-25' },
  { id: 'p6', leadId: 'l4', leadName: 'Meera Joshi', track: 'Franchise Ready', program: 'Franchise Ready', status: 'Draft', content: '', createdAt: '2024-12-14', sentAt: null, openedAt: null, signedAt: null },
];

export const sequences: AutomationSequence[] = [
  {
    id: 's1', name: 'Not Ready — Gap nurture', track: 'Not Ready',
    steps: [
      { id: 'st1', stepNumber: 1, delay: 0, delayUnit: 'hours', channel: 'WhatsApp', template: 'gap_nurture_intro' },
      { id: 'st2', stepNumber: 2, delay: 2, delayUnit: 'days', channel: 'Email', template: 'gap_nurture_resources' },
      { id: 'st3', stepNumber: 3, delay: 5, delayUnit: 'days', channel: 'WhatsApp', template: 'gap_nurture_checkin' },
      { id: 'st4', stepNumber: 4, delay: 10, delayUnit: 'days', channel: 'Email', template: 'gap_nurture_content' },
      { id: 'st5', stepNumber: 5, delay: 15, delayUnit: 'days', channel: 'WhatsApp', template: 'gap_nurture_offer' },
      { id: 'st6', stepNumber: 6, delay: 18, delayUnit: 'days', channel: 'Voice', template: 'gap_nurture_call' },
      { id: 'st7', stepNumber: 7, delay: 20, delayUnit: 'days', channel: 'WhatsApp', template: 'gap_nurture_final' },
    ],
    activeLeads: 23, lastTriggered: '2024-12-14T08:00:00Z',
  },
  {
    id: 's2', name: 'Franchise Ready — Discovery push', track: 'Franchise Ready',
    steps: [
      { id: 'st8', stepNumber: 1, delay: 0, delayUnit: 'hours', channel: 'WhatsApp', template: 'discovery_intro' },
      { id: 'st9', stepNumber: 2, delay: 1, delayUnit: 'days', channel: 'Email', template: 'discovery_benefits' },
      { id: 'st10', stepNumber: 3, delay: 3, delayUnit: 'days', channel: 'WhatsApp', template: 'discovery_book_cta' },
      { id: 'st11', stepNumber: 4, delay: 5, delayUnit: 'days', channel: 'Voice', template: 'discovery_call_attempt' },
    ],
    activeLeads: 15, lastTriggered: '2024-12-14T07:30:00Z',
  },
  {
    id: 's3', name: 'Recruitment Only — Eden routing', track: 'Recruitment Only',
    steps: [
      { id: 'st12', stepNumber: 1, delay: 0, delayUnit: 'hours', channel: 'WhatsApp', template: 'eden_routing_intro' },
      { id: 'st13', stepNumber: 2, delay: 1, delayUnit: 'days', channel: 'Email', template: 'eden_details' },
    ],
    activeLeads: 5, lastTriggered: '2024-12-13T14:00:00Z',
  },
  {
    id: 's4', name: 'Post-proposal follow-up', track: 'Franchise Ready',
    steps: [
      { id: 'st14', stepNumber: 1, delay: 1, delayUnit: 'days', channel: 'WhatsApp', template: 'proposal_followup_1' },
      { id: 'st15', stepNumber: 2, delay: 3, delayUnit: 'days', channel: 'Email', template: 'proposal_followup_2' },
      { id: 'st16', stepNumber: 3, delay: 5, delayUnit: 'days', channel: 'Voice', template: 'proposal_followup_call' },
    ],
    activeLeads: 8, lastTriggered: '2024-12-14T06:00:00Z',
  },
  {
    id: 's5', name: 'No-response voice trigger', track: 'Franchise Ready',
    steps: [
      { id: 'st17', stepNumber: 1, delay: 7, delayUnit: 'days', channel: 'Voice', template: 'noresponse_voice' },
      { id: 'st18', stepNumber: 2, delay: 10, delayUnit: 'days', channel: 'WhatsApp', template: 'noresponse_final_wa' },
    ],
    activeLeads: 3, lastTriggered: '2024-12-12T10:00:00Z',
  },
];

export const automationLogs: AutomationLog[] = [
  { id: 'al1', leadId: 'l3', leadName: 'Rajesh Kumar', sequenceName: 'Not Ready — Gap nurture', step: 3, channel: 'WhatsApp', status: 'Sent', sentAt: '2024-12-14T06:30:00Z', openedAt: null },
  { id: 'al2', leadId: 'l1', leadName: 'Vikram Singh', sequenceName: 'Franchise Ready — Discovery push', step: 2, channel: 'Email', status: 'Opened', sentAt: '2024-12-13T10:00:00Z', openedAt: '2024-12-13T14:00:00Z' },
  { id: 'al3', leadId: 'l6', leadName: 'Kavita Nair', sequenceName: 'Recruitment Only — Eden routing', step: 1, channel: 'WhatsApp', status: 'Sent', sentAt: '2024-12-14T03:00:00Z', openedAt: null },
  { id: 'al4', leadId: 'l18', leadName: 'Swati Kapoor', sequenceName: 'Not Ready — Gap nurture', step: 5, channel: 'WhatsApp', status: 'Pending', sentAt: '2024-12-15T08:00:00Z', openedAt: null },
  { id: 'al5', leadId: 'l2', leadName: 'Anita Desai', sequenceName: 'Post-proposal follow-up', step: 1, channel: 'WhatsApp', status: 'Sent', sentAt: '2024-12-14T08:00:00Z', openedAt: null },
  { id: 'al6', leadId: 'l10', leadName: 'Neha Gupta', sequenceName: 'Not Ready — Gap nurture', step: 6, channel: 'Voice', status: 'Failed', sentAt: '2024-12-13T09:00:00Z', openedAt: null },
];

export const clients: Client[] = [
  { id: 'cl1', leadId: 'l7', name: 'Amit Patel', signedDate: '2024-11-10', program: 'Franchise Ready', onboardingStatus: 'In Progress', onboardingProgress: 65, referralCode: 'FR-AMIT-2024', referrals: [{ name: 'Pooja Iyer', stage: 'Reminders Sent', addedDate: '2024-12-04' }] },
  { id: 'cl2', leadId: 'l19', name: 'Vishal Sharma', signedDate: '2024-10-25', program: 'Franchise Performance', onboardingStatus: 'In Progress', onboardingProgress: 80, referralCode: 'FR-VISHAL-2024', referrals: [] },
  { id: 'cl3', leadId: 'c3', name: 'Pradeep Nair', signedDate: '2024-09-15', program: 'Franchise Launch', onboardingStatus: 'Complete', onboardingProgress: 100, referralCode: 'FR-PRADEEP-2024', referrals: [{ name: 'Vikram Singh', stage: 'Discovery Booked', addedDate: '2024-12-01' }, { name: 'Anita Desai', stage: 'Proposal Sent', addedDate: '2024-11-15' }] },
];

export const notifications: Notification[] = [
  { id: 'n1', type: 'lead_added', description: 'New lead Sanjay Bhat added from Meta Ad', leadId: 'l13', timestamp: '2024-12-14T10:30:00Z', read: false },
  { id: 'n2', type: 'lead_added', description: 'New lead Harish Goel added from Meta Ad', leadId: 'l25', timestamp: '2024-12-14T09:15:00Z', read: false },
  { id: 'n3', type: 'call_booked', description: 'Discovery call booked with Rohit Agarwal', leadId: 'l11', timestamp: '2024-12-14T07:00:00Z', read: false },
  { id: 'n4', type: 'email_opened', description: 'Meera Joshi opened proposal email', leadId: 'l4', timestamp: '2024-12-14T05:00:00Z', read: true },
  { id: 'n5', type: 'proposal_sent', description: 'Proposal sent to Anita Desai', leadId: 'l2', timestamp: '2024-12-13T16:00:00Z', read: true },
  { id: 'n6', type: 'client_signed', description: 'Amit Patel signed Franchise Ready!', leadId: 'l7', timestamp: '2024-12-11T10:00:00Z', read: true },
  { id: 'n7', type: 'stage_changed', description: 'Lakshmi Rao routed to Eden', leadId: 'l14', timestamp: '2024-12-13T10:00:00Z', read: true },
  { id: 'n8', type: 'wa_sent', description: 'Nurture WA sent to Rajesh Kumar', leadId: 'l3', timestamp: '2024-12-14T06:30:00Z', read: false },
];

export const dashboardStats: DashboardStats = {
  totalLeads: leads.length,
  notReady: leads.filter(l => l.track === 'Not Ready').length,
  franchiseReady: leads.filter(l => l.track === 'Franchise Ready').length,
  recruitmentOnly: leads.filter(l => l.track === 'Recruitment Only').length,
  signedClients: clients.length,
  weeklyDeltas: { totalLeads: 5, notReady: 2, franchiseReady: 3, recruitmentOnly: 1, signedClients: 1 },
  funnel: [
    { stage: 'Leads In', count: 25 },
    { stage: 'Scored', count: 20 },
    { stage: 'Track Assigned', count: 18 },
    { stage: 'Discovery Done', count: 12 },
    { stage: 'Proposal Sent', count: 8 },
    { stage: 'Signed', count: 3 },
  ],
  todayAgenda: [
    { id: 'ta1', leadName: 'Rohit Agarwal', leadId: 'l11', type: 'call', time: '10:00 AM', label: 'Discovery call' },
    { id: 'ta2', leadName: 'Karan Malhotra', leadId: 'l9', type: 'call', time: '11:30 AM', label: 'Discovery call' },
    { id: 'ta3', leadName: 'Anita Desai', leadId: 'l2', type: 'proposal_followup', time: '2:00 PM', label: 'Proposal follow-up' },
    { id: 'ta4', leadName: 'Rajesh Kumar', leadId: 'l3', type: 'wa_followup', time: '3:00 PM', label: 'WA follow-up' },
    { id: 'ta5', leadName: 'Swati Kapoor', leadId: 'l18', type: 'sequence_step', time: '4:00 PM', label: 'Sequence step due' },
  ],
};

export const settings: Settings = {
  thresholds: { notReadyBelow: 40, franchiseReadyMin: 40, franchiseReadyMax: 100 },
  integrations: [
    { id: 'i1', name: 'WhatsApp (Meta Cloud API)', icon: 'MessageCircle', connected: true, apiKey: '••••••••••••abcd' },
    { id: 'i2', name: 'Cal.com', icon: 'Calendar', connected: true, apiKey: '••••••••••••efgh' },
    { id: 'i3', name: 'Resend (Email)', icon: 'Mail', connected: false, apiKey: '' },
    { id: 'i4', name: 'Claude API (Anthropic)', icon: 'Zap', connected: true, apiKey: '••••••••••••ijkl' },
    { id: 'i5', name: 'Meta Ads (Webhook)', icon: 'Globe', connected: true, apiKey: '••••••••••••mnop' },
  ],
  waTemplates: [
    { id: 'wt1', name: 'Gap Nurture Intro', body: 'Hi {lead_name}! This is {consultant_name} from Franchise Ready. We noticed you\'re interested in franchising...', channel: 'WhatsApp' },
    { id: 'wt2', name: 'Discovery Booking CTA', body: 'Hi {lead_name}, your franchise score is {score}/100! Book a free discovery call to discuss your options...', channel: 'WhatsApp' },
    { id: 'wt3', name: 'Proposal Follow-up', body: 'Hi {lead_name}, just checking if you had a chance to review our proposal. Happy to answer any questions!', channel: 'WhatsApp' },
  ],
  emailTemplates: [
    { id: 'et1', name: 'Welcome Email', subject: 'Welcome to Franchise Ready, {lead_name}!', body: '<h2>Welcome!</h2><p>Thank you for your interest in franchising...</p>', isHtml: true, channel: 'Email' },
    { id: 'et2', name: 'Proposal Email', subject: 'Your Franchise Proposal — {lead_name}', body: '<h2>Your Custom Proposal</h2><p>Based on your discovery call...</p>', isHtml: true, channel: 'Email' },
  ],
};

export { team };
