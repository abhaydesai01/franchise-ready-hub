export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  mongoUri: process.env.MONGODB_URI ?? '',
  /** Public base URL for locally served PDFs (e.g. https://api.example.com) — no trailing slash */
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, ''),
  scorecardInternalSecret: process.env.SCORECARD_INTERNAL_SECRET ?? '',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
  s3: {
    bucket: process.env.SCORECARD_S3_BUCKET ?? '',
    region: process.env.SCORECARD_S3_REGION ?? process.env.AWS_REGION ?? 'ap-south-1',
    publicBaseUrl: (process.env.SCORECARD_S3_PUBLIC_BASE_URL ?? '').replace(/\/$/, ''),
  },
  /** Fallback Calendly URL for scorecard email CTA (CRM `crm_settings` takes precedence). */
  calendlyLink: process.env.CALENDLY_LINK ?? '',
  /** Same Redis TCP URL as CRM BullMQ workers (`rediss://...`). */
  redisUrl: process.env.REDIS_URL ?? '',
  /** Public CRM URL for links in emails (e.g. https://app.example.com). */
  crmPublicUrl: (process.env.CRM_PUBLIC_URL ?? '').replace(/\/$/, ''),
  /** Shared secret for CRM → API internal webhooks (e.g. WhatsApp follow-up). */
  internalWebhookSecret: process.env.INTERNAL_WEBHOOK_SECRET ?? '',
  /** VAPI.ai — same as VOICE_API_KEY in .env */
  voiceApiKey: process.env.VOICE_API_KEY ?? '',
  voiceAssistantId: process.env.VOICE_ASSISTANT_ID ?? '',
  /** VAPI outbound caller ID (dashboard → Phone numbers). */
  vapiPhoneNumberId: process.env.VAPI_PHONE_NUMBER_ID ?? '',
  vapiWebhookSecret: process.env.VAPI_WEBHOOK_SECRET ?? '',
  /** Vaani Voice (https://vaanivoice.ai) — outbound agent; env overrides Settings UI. */
  vaaniApiKey: process.env.VAANI_API_KEY ?? '',
  vaaniAgentId: process.env.VAANI_AGENT_ID ?? '',
  vaaniBaseUrl: (process.env.VAANI_BASE_URL ?? 'https://api.vaanivoice.ai').replace(
    /\/$/,
    '',
  ),
  vaaniOutboundNumber: process.env.VAANI_OUTBOUND_NUMBER ?? '',
  vaaniWebhookSecret: process.env.VAANI_WEBHOOK_SECRET ?? '',
  companyName: process.env.COMPANY_NAME ?? 'Franchise Ready',
  /** Google AI Studio / Gemini — voice-call → scorecard + track (optional). */
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  /** Override via ANTHROPIC_MODEL — see Anthropic console for exact IDs */
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
  jwt: {
    accessTokenTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTokenTtl: process.env.JWT_REFRESH_TTL ?? '7d',
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'change-me-access',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh',
  },
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  azureClientId: process.env.AZURE_CLIENT_ID ?? '',
  azureClientSecret: process.env.AZURE_CLIENT_SECRET ?? '',
  azureTenantId: process.env.AZURE_TENANT_ID ?? 'common',
  calendarTokenEncryptionKey: process.env.CALENDAR_TOKEN_ENCRYPTION_KEY ?? '',
  /** OAuth redirect base — same as PUBLIC_BASE_URL (API origin). */
  frontendUrl: (process.env.FRONTEND_URL ?? process.env.CRM_PUBLIC_URL ?? '').replace(
    /\/$/,
    '',
  ),
});
