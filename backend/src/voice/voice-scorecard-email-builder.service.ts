import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const Q = [
  'May I know your brand name and what business category you are in?',
  'How many operational outlets or locations do you currently have?',
  'Which city are you currently operating from?',
  'Are you looking for full franchise consulting, franchise recruitment, or both?',
  'Have you already documented your operations, costing, and SOPs, or would you need support in building that?',
] as const;

@Injectable()
export class VoiceScorecardEmailBuilderService {
  private readonly log = new Logger(VoiceScorecardEmailBuilderService.name);

  constructor(private readonly config: ConfigService) {}

  async buildBodies(
    summary: string,
    transcript: string,
  ): Promise<{
    eventDescription: string;
    leadHtml: string;
    consultantHtml: string;
  }> {
    const combined = [summary, transcript].filter(Boolean).join('\n\n');
    const answers = await this.extractWithGeminiOrFallback(combined);

    const scorecardTable = this.formatScorecardTable(answers);
    const eventDescription = this.plainTextEventDescription(summary, answers);

    const leadHtml = this.htmlWrap(
      'Your discovery call — details',
      `<p>Thank you for spending time with us. Your Google Meet is in the calendar invite. Below is a short scorecard from what we heard on the call (best-effort from the recording/summary).</p>
      <h3>Call summary</h3>
      <blockquote style="border-left:3px solid #c00;padding-left:12px;margin:12px 0;">${this.escapeHtml(summary || '—')}</blockquote>
      <h3>Franchise readiness — quick scorecard</h3>
      ${scorecardTable}`,
    );

    const consultantHtml = this.htmlWrap(
      'Voice lead — same scorecard for your file',
      `<h3>Call summary</h3>
      <blockquote style="border-left:3px solid #333;padding-left:12px;margin:12px 0;">${this.escapeHtml(summary || '—')}</blockquote>
      <h3>Scorecard (5 questions)</h3>
      ${scorecardTable}
      <p style="color:#666;font-size:12px">Transcript excerpt: ${this.escapeHtml(transcript.slice(0, 2000) || '—')}${transcript.length > 2000 ? '…' : ''}</p>`,
    );

    return { eventDescription, leadHtml, consultantHtml };
  }

  private formatScorecardTable(answers: string[]): string {
    return `<table cellpadding="6" style="border-collapse:collapse;max-width:100%;">
      ${Q.map(
        (q, i) =>
          `<tr><td style="vertical-align:top;border:1px solid #ddd;font-weight:600;">${i + 1}. ${this.escapeHtml(q)}</td>
          <td style="border:1px solid #ddd;">${this.escapeHtml(answers[i] || '—')}</td></tr>`,
      ).join('')}
    </table>`;
  }

  private plainTextEventDescription(summary: string, answers: string[]): string {
    const lines: string[] = [
      'Franchise CRM — voice booking',
      '',
      '=== Call summary ===',
      summary || '—',
      '',
      '=== Scorecard (5 questions) ===',
    ];
    for (let i = 0; i < Q.length; i++) {
      lines.push(`${i + 1}. ${Q[i]}`);
      lines.push(answers[i] || '—');
    }
    return lines.join('\n');
  }

  private async extractWithGeminiOrFallback(
    text: string,
  ): Promise<string[]> {
    const key = this.config.get<string>('geminiApiKey')?.trim();
    if (!key || !text?.trim()) {
      return this.fivePlaceholdersWithSummaryBlurb(text);
    }
    const modelName =
      this.config.get<string>('geminiModel')?.trim() || 'gemini-2.0-flash';
    try {
      const gen = new GoogleGenerativeAI(key);
      const model = gen.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: 'application/json' },
        systemInstruction: `You help fill a franchise lead scorecard from a phone call. Only use information stated or clearly implied. If unknown, use a short "Not specified on call" or "Unclear from recording". Return JSON with keys a1..a5 (strings) matching:
a1: brand and category
a2: number of outlets/locations
a3: city / market
a4: consulting, recruitment, or both / neither
a5: SOPs/ops documentation status or need for help`,
      });
      const r = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: `Transcript and summary:\n\n${text.slice(0, 32_000)}` }] },
        ],
      });
      const raw = (r.response.text() || '').trim().replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/i, '');
      const p = JSON.parse(raw) as Record<string, string>;
      return [
        String(p.a1 ?? p.q1 ?? ''),
        String(p.a2 ?? p.q2 ?? ''),
        String(p.a3 ?? p.q3 ?? ''),
        String(p.a4 ?? p.q4 ?? ''),
        String(p.a5 ?? p.q5 ?? ''),
      ].map((s) => s || '—');
    } catch (e) {
      this.log.warn('Gemini scorecard email extraction failed, using fallbacks', e);
      return this.fivePlaceholdersWithSummaryBlurb(text);
    }
  }

  private fivePlaceholdersWithSummaryBlurb(text: string): string[] {
    const t = (text || '').trim();
    if (!t) {
      return Array(5).fill('—') as string[];
    }
    const b = 'Best-effort: see call summary: ' + t.slice(0, 400) + (t.length > 400 ? '…' : '');
    return [b, b, b, b, b];
  }

  private htmlWrap(title: string, inner: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${this.escapeHtml(title)}</title></head><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.45;max-width:640px">
      <h1 style="font-size:18px;">${this.escapeHtml(title)}</h1>
      ${inner}
    </body></html>`;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
