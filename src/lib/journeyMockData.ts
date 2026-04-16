import type { JourneyEvent, WAConversation, WAMessage, CampaignAttribution } from '@/types';

// Campaign attributions for leads that came from Meta Ads
export const campaignAttributions: Record<string, CampaignAttribution> = {
  l1: {
    campaignId: 'camp_001', campaignName: 'Franchise Awareness Q4',
    adsetId: 'as_001', adsetName: 'Mumbai 25-45 Entrepreneurs',
    adId: 'ad_001', adName: 'QSR Franchise Opportunity Video',
    platform: 'Instagram', objective: 'MESSAGES',
    costPerLead: 142,
  },
  l3: {
    campaignId: 'camp_002', campaignName: 'Gap Nurture Retargeting',
    adsetId: 'as_003', adsetName: 'Website Visitors 30d',
    adId: 'ad_005', adName: 'Not Ready Yet? We Can Help',
    platform: 'Facebook', objective: 'LEAD_GENERATION',
    costPerLead: 89, formId: 'form_001', formName: 'Franchise Interest Form',
  },
  l6: {
    campaignId: 'camp_001', campaignName: 'Franchise Awareness Q4',
    adsetId: 'as_002', adsetName: 'Delhi NCR Business Owners',
    adId: 'ad_003', adName: 'Own a Franchise in 90 Days',
    platform: 'Facebook', objective: 'MESSAGES',
    costPerLead: 156,
  },
  l8: {
    campaignId: 'camp_003', campaignName: 'Discovery Call Push Dec',
    adsetId: 'as_004', adsetName: 'Lookalike Signed Clients',
    adId: 'ad_007', adName: 'Book Your Free Discovery Call',
    platform: 'Instagram', objective: 'LEAD_GENERATION',
    costPerLead: 198, formId: 'form_002', formName: 'Discovery Call Booking',
  },
  l13: {
    campaignId: 'camp_002', campaignName: 'Gap Nurture Retargeting',
    adsetId: 'as_003', adsetName: 'Website Visitors 30d',
    adId: 'ad_006', adName: 'Start Your Franchise Journey',
    platform: 'Facebook', objective: 'LEAD_GENERATION',
    costPerLead: 75, formId: 'form_001', formName: 'Franchise Interest Form',
  },
  l14: {
    campaignId: 'camp_001', campaignName: 'Franchise Awareness Q4',
    adsetId: 'as_002', adsetName: 'Delhi NCR Business Owners',
    adId: 'ad_004', adName: 'Recruitment Opportunities Carousel',
    platform: 'Instagram', objective: 'MESSAGES',
    costPerLead: 167,
  },
  l17: {
    campaignId: 'camp_003', campaignName: 'Discovery Call Push Dec',
    adsetId: 'as_005', adsetName: 'Engaged Leads Retarget',
    adId: 'ad_008', adName: 'Limited Slots — Book Now',
    platform: 'Facebook', objective: 'MESSAGES',
    costPerLead: 210,
  },
  l25: {
    campaignId: 'camp_002', campaignName: 'Gap Nurture Retargeting',
    adsetId: 'as_003', adsetName: 'Website Visitors 30d',
    adId: 'ad_005', adName: 'Not Ready Yet? We Can Help',
    platform: 'Facebook', objective: 'LEAD_GENERATION',
    costPerLead: 82, formId: 'form_001', formName: 'Franchise Interest Form',
  },
};

// WhatsApp conversations for select leads
export const waConversations: WAConversation[] = [
  {
    leadId: 'l1', phoneNumber: '+919876543210', totalMessages: 12, lastMessageAt: '2024-12-14T08:15:00Z', isActive: true,
    messages: [
      { id: 'wm1', leadId: 'l1', direction: 'inbound', type: 'text', body: 'Hi, I saw your ad about franchise opportunities. Can you tell me more?', status: 'read', timestamp: '2024-12-01T09:30:00Z' },
      { id: 'wm2', leadId: 'l1', direction: 'outbound', type: 'template', body: 'Hello Vikram! 👋 Thanks for reaching out. I\'m Priya from Franchise Ready. We help aspiring entrepreneurs find and launch the right franchise. What kind of franchise are you interested in?', templateName: 'welcome_ctwa', status: 'read', timestamp: '2024-12-01T09:32:00Z', agentName: 'Priya Sharma' },
      { id: 'wm3', leadId: 'l1', direction: 'inbound', type: 'text', body: 'I\'m interested in QSR franchises. I have about 40L to invest and I\'m based in Mumbai.', status: 'read', timestamp: '2024-12-01T09:45:00Z' },
      { id: 'wm4', leadId: 'l1', direction: 'outbound', type: 'text', body: 'Great choice! QSR is a booming sector. With 40L capital and Mumbai as your base, you have excellent options. Let me share some details about our Franchise Ready program.', status: 'read', timestamp: '2024-12-01T09:50:00Z', agentName: 'Priya Sharma' },
      { id: 'wm5', leadId: 'l1', direction: 'outbound', type: 'document', body: '📄 Franchise_Ready_Brochure.pdf', mediaUrl: '/docs/brochure.pdf', status: 'read', timestamp: '2024-12-01T09:51:00Z', agentName: 'Priya Sharma' },
      { id: 'wm6', leadId: 'l1', direction: 'inbound', type: 'text', body: 'This looks great. How do I get started?', status: 'read', timestamp: '2024-12-01T14:20:00Z' },
      { id: 'wm7', leadId: 'l1', direction: 'outbound', type: 'text', body: 'The first step is a free 30-min Discovery Call with our franchise consultant. I\'ll send you a booking link!', status: 'read', timestamp: '2024-12-01T14:25:00Z', agentName: 'Priya Sharma' },
      { id: 'wm8', leadId: 'l1', direction: 'outbound', type: 'template', body: '📅 Book your Discovery Call here: https://cal.com/franchise-ready/vikram\n\nSlots filling fast for this week!', templateName: 'discovery_booking_cta', status: 'delivered', timestamp: '2024-12-01T14:26:00Z', agentName: 'Priya Sharma' },
      { id: 'wm9', leadId: 'l1', direction: 'inbound', type: 'button_reply', body: 'Book Now ✅', status: 'read', timestamp: '2024-12-01T15:00:00Z' },
      { id: 'wm10', leadId: 'l1', direction: 'outbound', type: 'text', body: 'Your Discovery Call is confirmed for Dec 5 at 10 AM. Looking forward to it, Vikram! 🎉', status: 'read', timestamp: '2024-12-01T15:05:00Z', agentName: 'Priya Sharma' },
      { id: 'wm11', leadId: 'l1', direction: 'outbound', type: 'template', body: '⏰ Reminder: Your Discovery Call is tomorrow at 10 AM. See you there!', templateName: 'call_reminder', status: 'delivered', timestamp: '2024-12-04T10:00:00Z', agentName: 'System' },
      { id: 'wm12', leadId: 'l1', direction: 'outbound', type: 'template', body: 'Hi Vikram, just following up on your Discovery Call. Have you had time to think about the options we discussed?', templateName: 'post_call_followup', status: 'delivered', timestamp: '2024-12-14T08:15:00Z', agentName: 'Priya Sharma' },
    ],
  },
  {
    leadId: 'l9', phoneNumber: '+919876543218', totalMessages: 8, lastMessageAt: '2024-12-14T07:45:00Z', isActive: true,
    messages: [
      { id: 'wm20', leadId: 'l9', direction: 'inbound', type: 'text', body: 'Hello, I want to know about franchise investment options', status: 'read', timestamp: '2024-12-06T11:00:00Z' },
      { id: 'wm21', leadId: 'l9', direction: 'outbound', type: 'template', body: 'Hi Karan! Welcome to Franchise Ready. 🙏 We\'d love to help you explore franchise opportunities. What\'s your budget range and preferred city?', templateName: 'welcome_wa_inbound', status: 'read', timestamp: '2024-12-06T11:05:00Z', agentName: 'Priya Sharma' },
      { id: 'wm22', leadId: 'l9', direction: 'inbound', type: 'text', body: 'I have around 30L. Looking for something in Pune or Mumbai.', status: 'read', timestamp: '2024-12-06T11:20:00Z' },
      { id: 'wm23', leadId: 'l9', direction: 'outbound', type: 'text', body: 'Perfect! With 30L, you have several great options in Pune/Mumbai. I\'d recommend a Discovery Call with our consultant to explore the best fit.', status: 'read', timestamp: '2024-12-06T11:30:00Z', agentName: 'Priya Sharma' },
      { id: 'wm24', leadId: 'l9', direction: 'inbound', type: 'text', body: 'Sure, when can we do the call?', status: 'read', timestamp: '2024-12-06T12:00:00Z' },
      { id: 'wm25', leadId: 'l9', direction: 'outbound', type: 'template', body: '📅 Book your free Discovery Call: https://cal.com/franchise-ready/karan', templateName: 'discovery_booking_cta', status: 'read', timestamp: '2024-12-06T12:05:00Z', agentName: 'Priya Sharma' },
      { id: 'wm26', leadId: 'l9', direction: 'inbound', type: 'text', body: 'Booked for Dec 16. Thanks!', status: 'read', timestamp: '2024-12-06T14:00:00Z' },
      { id: 'wm27', leadId: 'l9', direction: 'outbound', type: 'template', body: '⏰ Reminder: Your Discovery Call is on Dec 16 at 11:30 AM. Karan, we\'re excited to help you!', templateName: 'call_reminder', status: 'delivered', timestamp: '2024-12-14T07:45:00Z', agentName: 'System' },
    ],
  },
  {
    leadId: 'l3', phoneNumber: '+919876543212', totalMessages: 5, lastMessageAt: '2024-12-14T06:30:00Z', isActive: true,
    messages: [
      { id: 'wm30', leadId: 'l3', direction: 'outbound', type: 'template', body: 'Hi Rajesh! 👋 We noticed you filled our franchise interest form. While your profile is building up, here are some resources to help you prepare...', templateName: 'gap_nurture_intro', status: 'read', timestamp: '2024-12-10T10:00:00Z', agentName: 'System' },
      { id: 'wm31', leadId: 'l3', direction: 'inbound', type: 'text', body: 'Thanks. How much capital do I need to start?', status: 'read', timestamp: '2024-12-10T14:00:00Z' },
      { id: 'wm32', leadId: 'l3', direction: 'outbound', type: 'text', body: 'It depends on the type of franchise. QSR starts from 15L, retail from 20L, and education from 10L. We can help you plan!', status: 'read', timestamp: '2024-12-10T14:15:00Z', agentName: 'Priya Sharma' },
      { id: 'wm33', leadId: 'l3', direction: 'outbound', type: 'template', body: 'Hi Rajesh, here\'s a helpful guide on building your franchise capital: [link]. Let us know if you have questions!', templateName: 'gap_nurture_resources', status: 'delivered', timestamp: '2024-12-12T10:00:00Z', agentName: 'System' },
      { id: 'wm34', leadId: 'l3', direction: 'outbound', type: 'template', body: 'Hi Rajesh, just checking in. Have you had a chance to review the resources? Happy to chat if you have questions! 🙂', templateName: 'gap_nurture_checkin', status: 'sent', timestamp: '2024-12-14T06:30:00Z', agentName: 'System' },
    ],
  },
  {
    leadId: 'l13', phoneNumber: '+919876543222', totalMessages: 2, lastMessageAt: '2024-12-14T10:35:00Z', isActive: true,
    messages: [
      { id: 'wm40', leadId: 'l13', direction: 'outbound', type: 'template', body: 'Hi Sanjay! Thanks for your interest in franchising. 🙏 We\'re Franchise Ready — India\'s leading franchise consulting firm. Let\'s get to know you better!', templateName: 'welcome_lead_ads', status: 'delivered', timestamp: '2024-12-14T10:32:00Z', agentName: 'System' },
      { id: 'wm41', leadId: 'l13', direction: 'inbound', type: 'text', body: 'Hi, yes I filled the form. What are the next steps?', status: 'read', timestamp: '2024-12-14T10:35:00Z' },
    ],
  },
];

// Full journey events for lead l1 (Vikram Singh — Click-to-WhatsApp Ad flow)
const l1Journey: JourneyEvent[] = [
  { id: 'je1', leadId: 'l1', type: 'ad_impression', title: 'Ad Impression', description: 'Saw "QSR Franchise Opportunity Video" on Instagram feed', timestamp: '2024-12-01T09:10:00Z', source: 'meta_ads', channel: 'instagram', metadata: { campaignName: 'Franchise Awareness Q4', adsetName: 'Mumbai 25-45 Entrepreneurs' } },
  { id: 'je2', leadId: 'l1', type: 'ad_click', title: 'Ad Clicked', description: 'Clicked "Send WhatsApp Message" CTA', timestamp: '2024-12-01T09:28:00Z', source: 'meta_ads', channel: 'instagram', metadata: { adName: 'QSR Franchise Opportunity Video', costPerClick: 12.5 } },
  { id: 'je3', leadId: 'l1', type: 'wa_opened', title: 'WhatsApp Opened', description: 'Opened WhatsApp from Click-to-WhatsApp ad', timestamp: '2024-12-01T09:29:00Z', source: 'whatsapp', channel: 'whatsapp' },
  { id: 'je4', leadId: 'l1', type: 'wa_first_message', title: 'First Message', description: '"Hi, I saw your ad about franchise opportunities..."', timestamp: '2024-12-01T09:30:00Z', source: 'whatsapp', channel: 'whatsapp' },
  { id: 'je5', leadId: 'l1', type: 'lead_created', title: 'Lead Created', description: 'Auto-created from WhatsApp conversation', timestamp: '2024-12-01T09:31:00Z', source: 'crm', metadata: { source: 'Meta Ad', autoCreated: true } },
  { id: 'je6', leadId: 'l1', type: 'wa_agent_reply', title: 'Agent Reply', description: 'Priya Sharma sent welcome template', timestamp: '2024-12-01T09:32:00Z', source: 'whatsapp', channel: 'whatsapp', metadata: { agentName: 'Priya Sharma', templateName: 'welcome_ctwa' } },
  { id: 'je7', leadId: 'l1', type: 'wa_message_received', title: 'WhatsApp Message', description: 'Shared investment budget (40L) and location (Mumbai)', timestamp: '2024-12-01T09:45:00Z', source: 'whatsapp', channel: 'whatsapp' },
  { id: 'je8', leadId: 'l1', type: 'lead_scored', title: 'Lead Scored', description: 'Franchise Score calculated: 78/100', timestamp: '2024-12-01T10:00:00Z', source: 'crm', metadata: { score: 78 } },
  { id: 'je9', leadId: 'l1', type: 'track_assigned', title: 'Track Assigned', description: 'Routed to Franchise Ready track (score ≥ 40)', timestamp: '2024-12-01T10:01:00Z', source: 'crm', metadata: { track: 'Franchise Ready', rule: 'Score threshold' } },
  { id: 'je10', leadId: 'l1', type: 'sequence_started', title: 'Sequence Started', description: 'Enrolled in "Franchise Ready — Discovery push"', timestamp: '2024-12-01T10:05:00Z', source: 'automation' },
  { id: 'je11', leadId: 'l1', type: 'wa_message_sent', title: 'Brochure Sent', description: 'Franchise Ready brochure shared via WhatsApp', timestamp: '2024-12-01T09:51:00Z', source: 'whatsapp', channel: 'whatsapp', metadata: { type: 'document' } },
  { id: 'je12', leadId: 'l1', type: 'call_booked', title: 'Discovery Call Booked', description: 'Booked for Dec 5, 10:00 AM with Priya Sharma', timestamp: '2024-12-01T15:00:00Z', source: 'crm', metadata: { consultantName: 'Priya Sharma', scheduledAt: '2024-12-05T10:00:00Z' } },
  { id: 'je13', leadId: 'l1', type: 'wa_template_sent', title: 'Reminder Sent', description: 'Call reminder template sent via WhatsApp', timestamp: '2024-12-04T10:00:00Z', source: 'automation', channel: 'whatsapp' },
  { id: 'je14', leadId: 'l1', type: 'call_completed', title: 'Discovery Call Done', description: '30-min call completed. Interested in QSR brands in Mumbai.', timestamp: '2024-12-05T10:35:00Z', source: 'crm', metadata: { duration: '35 mins' } },
  { id: 'je15', leadId: 'l1', type: 'stage_changed', title: 'Stage → Discovery Booked', description: 'Moved to Discovery Booked stage', timestamp: '2024-12-05T10:36:00Z', source: 'crm' },
  { id: 'je16', leadId: 'l1', type: 'email_sent', title: 'Follow-up Email', description: 'Post-call summary email sent', timestamp: '2024-12-05T11:00:00Z', source: 'automation', channel: 'email' },
  { id: 'je17', leadId: 'l1', type: 'email_opened', title: 'Email Opened', description: 'Vikram opened the follow-up email', timestamp: '2024-12-05T14:20:00Z', source: 'automation', channel: 'email' },
  { id: 'je18', leadId: 'l1', type: 'wa_template_sent', title: 'Follow-up WA', description: 'Post-call follow-up WhatsApp sent', timestamp: '2024-12-14T08:15:00Z', source: 'whatsapp', channel: 'whatsapp' },
];

// Journey for l13 (Sanjay Bhat — Meta Lead Ads form flow)
const l13Journey: JourneyEvent[] = [
  { id: 'je30', leadId: 'l13', type: 'ad_impression', title: 'Ad Impression', description: 'Saw "Start Your Franchise Journey" on Facebook feed', timestamp: '2024-12-14T10:10:00Z', source: 'meta_ads', channel: 'facebook', metadata: { campaignName: 'Gap Nurture Retargeting' } },
  { id: 'je31', leadId: 'l13', type: 'ad_click', title: 'Ad Clicked', description: 'Clicked "Learn More" CTA on Facebook', timestamp: '2024-12-14T10:20:00Z', source: 'meta_ads', channel: 'facebook' },
  { id: 'je32', leadId: 'l13', type: 'form_submitted', title: 'Lead Form Submitted', description: 'Filled "Franchise Interest Form" on Facebook', timestamp: '2024-12-14T10:25:00Z', source: 'meta_ads', channel: 'facebook', metadata: { formName: 'Franchise Interest Form', fields: 'name, phone, email, city, investment_range' } },
  { id: 'je33', leadId: 'l13', type: 'lead_created', title: 'Lead Created', description: 'Auto-created from Meta Lead Ads webhook', timestamp: '2024-12-14T10:25:30Z', source: 'crm', metadata: { source: 'Meta Ad', autoCreated: true } },
  { id: 'je34', leadId: 'l13', type: 'lead_scored', title: 'Lead Scored', description: 'Franchise Score calculated: 22/100', timestamp: '2024-12-14T10:26:00Z', source: 'crm', metadata: { score: 22 } },
  { id: 'je35', leadId: 'l13', type: 'track_assigned', title: 'Track Assigned', description: 'Routed to Not Ready track (score < 40)', timestamp: '2024-12-14T10:26:30Z', source: 'crm', metadata: { track: 'Not Ready', rule: 'Score threshold' } },
  { id: 'je36', leadId: 'l13', type: 'wa_template_sent', title: 'Welcome WhatsApp', description: 'Auto-sent welcome template via WhatsApp', timestamp: '2024-12-14T10:32:00Z', source: 'automation', channel: 'whatsapp', metadata: { templateName: 'welcome_lead_ads' } },
  { id: 'je37', leadId: 'l13', type: 'wa_message_received', title: 'WhatsApp Reply', description: '"Hi, yes I filled the form. What are the next steps?"', timestamp: '2024-12-14T10:35:00Z', source: 'whatsapp', channel: 'whatsapp' },
  { id: 'je38', leadId: 'l13', type: 'sequence_started', title: 'Sequence Started', description: 'Enrolled in "Not Ready — Gap nurture" sequence', timestamp: '2024-12-14T10:40:00Z', source: 'automation' },
];

// Journey for l3 (Rajesh Kumar — Lead Ads + nurture)
const l3Journey: JourneyEvent[] = [
  { id: 'je50', leadId: 'l3', type: 'ad_impression', title: 'Ad Impression', description: 'Saw "Not Ready Yet?" retargeting ad on Facebook', timestamp: '2024-12-10T09:00:00Z', source: 'meta_ads', channel: 'facebook' },
  { id: 'je51', leadId: 'l3', type: 'ad_click', title: 'Ad Clicked', description: 'Clicked "Fill Form" CTA', timestamp: '2024-12-10T09:15:00Z', source: 'meta_ads', channel: 'facebook' },
  { id: 'je52', leadId: 'l3', type: 'form_submitted', title: 'Lead Form Submitted', description: 'Submitted Franchise Interest Form', timestamp: '2024-12-10T09:20:00Z', source: 'meta_ads', channel: 'facebook' },
  { id: 'je53', leadId: 'l3', type: 'lead_created', title: 'Lead Created', description: 'Auto-created from Meta Lead Ads', timestamp: '2024-12-10T09:20:30Z', source: 'crm' },
  { id: 'je54', leadId: 'l3', type: 'lead_scored', title: 'Lead Scored', description: 'Score: 32/100 — needs capital building', timestamp: '2024-12-10T09:25:00Z', source: 'crm', metadata: { score: 32 } },
  { id: 'je55', leadId: 'l3', type: 'track_assigned', title: 'Track → Not Ready', description: 'Routed to Not Ready track', timestamp: '2024-12-10T09:25:30Z', source: 'crm' },
  { id: 'je56', leadId: 'l3', type: 'sequence_started', title: 'Nurture Sequence', description: 'Enrolled in "Not Ready — Gap nurture"', timestamp: '2024-12-10T09:30:00Z', source: 'automation' },
  { id: 'je57', leadId: 'l3', type: 'wa_template_sent', title: 'Nurture WA #1', description: 'Gap nurture intro template sent', timestamp: '2024-12-10T10:00:00Z', source: 'automation', channel: 'whatsapp' },
  { id: 'je58', leadId: 'l3', type: 'wa_message_received', title: 'WhatsApp Reply', description: '"How much capital do I need?"', timestamp: '2024-12-10T14:00:00Z', source: 'whatsapp', channel: 'whatsapp' },
  { id: 'je59', leadId: 'l3', type: 'wa_agent_reply', title: 'Agent Reply', description: 'Priya shared capital ranges by franchise type', timestamp: '2024-12-10T14:15:00Z', source: 'whatsapp', channel: 'whatsapp' },
  { id: 'je60', leadId: 'l3', type: 'sequence_step', title: 'Nurture Email', description: 'Gap nurture resources email sent (step 2)', timestamp: '2024-12-12T10:00:00Z', source: 'automation', channel: 'email' },
  { id: 'je61', leadId: 'l3', type: 'wa_template_sent', title: 'Nurture WA #3', description: 'Gap nurture check-in sent (step 3)', timestamp: '2024-12-14T06:30:00Z', source: 'automation', channel: 'whatsapp' },
];

// Combine all journey events
export const journeyEvents: JourneyEvent[] = [
  ...l1Journey,
  ...l13Journey,
  ...l3Journey,
].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

// Lookup helpers
export function getLeadJourney(leadId: string): JourneyEvent[] {
  return journeyEvents
    .filter(e => e.leadId === leadId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function getLeadConversation(leadId: string): WAConversation | undefined {
  return waConversations.find(c => c.leadId === leadId);
}

export function getLeadCampaign(leadId: string): CampaignAttribution | undefined {
  return campaignAttributions[leadId];
}
