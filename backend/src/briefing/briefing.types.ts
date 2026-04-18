export type LeadBriefingResponse = {
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
};
