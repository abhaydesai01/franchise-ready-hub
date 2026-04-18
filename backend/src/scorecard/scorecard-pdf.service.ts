import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type {
  GapArea,
  ReadinessBand,
  ScoreDimensionRow,
} from './scorecard.types';

const A4 = { w: 595.28, h: 841.89 };
const M = 48;

const BADGE: Record<ReadinessBand, { fill: string; text: string; label: string }> = {
  franchise_ready: {
    fill: '#16a34a',
    text: '#ffffff',
    label: 'Franchise ready',
  },
  recruitment_only: {
    fill: '#d97706',
    text: '#ffffff',
    label: 'Recruitment track',
  },
  not_ready: {
    fill: '#dc2626',
    text: '#ffffff',
    label: 'Not ready yet',
  },
};

export type PdfBranding = {
  companyName: string;
  logoUrl: string;
  supportEmail: string;
  supportPhone: string;
  website: string;
  addressLine: string;
};

@Injectable()
export class ScorecardPdfService {
  private readonly log = new Logger(ScorecardPdfService.name);

  async buildPdf(input: {
    leadName: string;
    generatedLabel: string;
    readinessBand: ReadinessBand;
    totalScore: number;
    dimensions: ScoreDimensionRow[];
    readinessSummary: string;
    gapAreas: GapArea[];
    branding: PdfBranding;
  }): Promise<Buffer> {
    const logoBuffer = await this.tryFetchLogo(input.branding.logoUrl);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ size: 'A4', margin: M, info: { Title: 'Franchise Readiness Report' } });

      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.renderCover(doc, input, logoBuffer);
      doc.addPage();
      this.renderBreakdown(doc, input);
      doc.addPage();
      this.renderNextSteps(doc, input);

      doc.end();
    });
  }

  private async tryFetchLogo(url: string): Promise<Buffer | null> {
    if (!url?.startsWith('http')) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.startsWith('image/')) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      this.log.warn(`Logo fetch failed: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }

  private renderCover(
    doc: InstanceType<typeof PDFDocument>,
    input: {
      leadName: string;
      generatedLabel: string;
      readinessBand: ReadinessBand;
      branding: PdfBranding;
    },
    logo: Buffer | null,
  ) {
    const cx = A4.w / 2;
    let y = M + 20;

    if (logo) {
      try {
        const w = 140;
        doc.image(logo, cx - w / 2, y, { width: w });
        y += 100;
        doc
          .fontSize(12)
          .fillColor('#374151')
          .font('Helvetica-Bold')
          .text(input.branding.companyName || ' ', M, y, {
            width: A4.w - 2 * M,
            align: 'center',
          });
        y += 24;
      } catch {
        y += 10;
      }
    } else {
      doc
        .fontSize(20)
        .fillColor('#111827')
        .text(input.branding.companyName || 'Your company', M, y, {
          width: A4.w - 2 * M,
          align: 'center',
        });
      y += 40;
    }

    doc
      .fontSize(11)
      .fillColor('#6b7280')
      .text('Franchise Readiness Report', M, y, {
        width: A4.w - 2 * M,
        align: 'center',
      });
    y += 28;

    doc
      .fontSize(26)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text(input.leadName, M, y, { width: A4.w - 2 * M, align: 'center' });
    doc.font('Helvetica');
    y += 44;

    doc
      .fontSize(10)
      .fillColor('#6b7280')
      .text(`Generated ${input.generatedLabel}`, M, y, {
        width: A4.w - 2 * M,
        align: 'center',
      });
    y += 80;

    const badge = BADGE[input.readinessBand];
    const bw = 280;
    const bh = 64;
    const bx = cx - bw / 2;
    doc.roundedRect(bx, y, bw, bh, 12).fill(badge.fill);
    doc
      .fontSize(16)
      .fillColor(badge.text)
      .font('Helvetica-Bold')
      .text(badge.label.toUpperCase(), bx, y + 22, {
        width: bw,
        align: 'center',
      });
    doc.font('Helvetica');
  }

  private renderBreakdown(
    doc: InstanceType<typeof PDFDocument>,
    input: {
      totalScore: number;
      dimensions: ScoreDimensionRow[];
      readinessSummary: string;
      gapAreas: GapArea[];
    },
  ) {
    doc
      .fontSize(18)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Score breakdown', M, M);
    doc.font('Helvetica');

    let y = M + 36;
    doc
      .fontSize(42)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text(String(input.totalScore), M, y);
    doc.font('Helvetica');
    doc.fontSize(14).fillColor('#6b7280').text('/ 100', M + 70, y + 14);
    y += 72;

    const barW = A4.w - 2 * M;
    const barH = 14;
    for (const d of input.dimensions) {
      doc.fontSize(10).fillColor('#374151').text(`${d.label}`, M, y);
      doc
        .fontSize(9)
        .fillColor('#9ca3af')
        .text(`${d.score} / ${d.max}`, M + barW - 60, y, { width: 60, align: 'right' });
      y += 16;
      doc.roundedRect(M, y, barW, barH, 4).fill('#e5e7eb');
      const pct = d.max > 0 ? Math.min(1, d.score / d.max) : 0;
      doc.roundedRect(M, y, Math.max(4, barW * pct), barH, 4).fill('#2563eb');
      y += barH + 18;
    }

    y += 8;
    doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold').text('Readiness summary', M, y);
    doc.font('Helvetica');
    y += 20;
    doc
      .fontSize(10)
      .fillColor('#374151')
      .text(input.readinessSummary, M, y, {
        width: A4.w - 2 * M,
        align: 'left',
        lineGap: 2,
      });
    y += Math.min(120, 14 * (input.readinessSummary.length / 90 + 2)) + 24;

    doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold').text('Gap areas', M, y);
    doc.font('Helvetica');
    y += 18;
    if (!input.gapAreas.length) {
      doc.fontSize(10).fillColor('#6b7280').text('No major gaps flagged from this scorecard.', M, y);
    } else {
      for (const g of input.gapAreas) {
        const line = `${g.title} — ${g.description}`;
        doc
          .fontSize(10)
          .fillColor('#374151')
          .font('Helvetica')
          .text(`• ${line}`, M, y, { width: A4.w - 2 * M, lineGap: 2 });
        y += 28 + Math.floor(line.length / 95) * 12;
      }
    }
  }

  private renderNextSteps(
    doc: InstanceType<typeof PDFDocument>,
    input: { branding: PdfBranding },
  ) {
    doc
      .fontSize(18)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text('What happens next', M, M);
    doc.font('Helvetica');

    const steps: { n: string; title: string; body: string }[] = [
      {
        n: '1',
        title: 'Discovery call',
        body: 'Speak with a franchise consultant to review your score, goals, and fit in a focused session.',
      },
      {
        n: '2',
        title: 'Personalised franchise plan',
        body: 'We outline practical next steps, timelines, and options matched to your readiness profile.',
      },
      {
        n: '3',
        title: 'Launch support',
        body: 'When you are ready, we help you move from planning into execution with structured support.',
      },
    ];

    let y = M + 40;
    const stepW = A4.w - 2 * M;
    for (const s of steps) {
      doc.roundedRect(M, y, stepW, 72, 8).stroke('#e5e7eb');
      doc.roundedRect(M + 12, y + 14, 28, 28, 6).fill('#2563eb');
      doc
        .fontSize(13)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text(s.n, M + 12, y + 21, { width: 28, align: 'center' });
      doc
        .fontSize(12)
        .fillColor('#111827')
        .text(s.title, M + 52, y + 16, { width: stepW - 68 });
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#4b5563')
        .text(s.body, M + 52, y + 34, { width: stepW - 68, lineGap: 2 });
      y += 88;
    }

    const b = input.branding;
    const footerY = A4.h - M - 72;
    doc
      .moveTo(M, footerY - 8)
      .lineTo(A4.w - M, footerY - 8)
      .stroke('#e5e7eb');
    doc.fontSize(9).fillColor('#6b7280');
    const lines = [
      b.companyName,
      [b.supportEmail, b.supportPhone].filter(Boolean).join(' · '),
      b.website,
      b.addressLine,
    ].filter((x) => x && String(x).trim().length > 0);
    let fy = footerY;
    for (const line of lines) {
      doc.text(line, M, fy, { width: A4.w - 2 * M, align: 'center' });
      fy += 12;
    }
  }
}
