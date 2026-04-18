import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class ScorecardEmailService {
  private readonly log = new Logger(ScorecardEmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendScorecardAttachment(input: {
    to: string;
    firstName: string;
    companyName: string;
    calendlyHint?: string;
    pdfBuffer: Buffer;
    fileName: string;
  }): Promise<{ ok: boolean; error?: string }> {
    const apiKey = this.config.get<string>('resendApiKey') ?? '';
    if (!apiKey) {
      this.log.warn('RESEND_API_KEY not set — skipping scorecard email');
      return { ok: false, error: 'email_not_configured' };
    }

    const from = this.config.get<string>('resendFromEmail') ?? 'onboarding@resend.dev';
    const resend = new Resend(apiKey);
    const cta = input.calendlyHint
      ? `Book your discovery call here: ${input.calendlyHint}`
      : 'Reply to this email or use the booking link we sent on WhatsApp to schedule your discovery call.';

    try {
      const { error } = await resend.emails.send({
        from,
        to: input.to,
        subject: `Your Franchise Readiness Report is ready, ${input.firstName}`,
        html: `
<p>Hi ${escapeHtml(input.firstName)},</p>
<p>Your personalised <strong>Franchise Readiness Report</strong> from ${escapeHtml(input.companyName)} is attached.</p>
<p>${escapeHtml(cta)}</p>
<p>We look forward to walking through your results on the call.</p>
<p>— ${escapeHtml(input.companyName)}</p>
`,
        attachments: [
          {
            filename: input.fileName,
            content: input.pdfBuffer,
          },
        ],
      });
      if (error) {
        this.log.error(`Resend error: ${error.message}`);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`Resend send failed: ${msg}`);
      return { ok: false, error: msg };
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
