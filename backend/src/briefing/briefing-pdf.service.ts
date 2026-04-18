import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { LeadBriefingResponse } from './briefing.types';

const M = 48;

@Injectable()
export class BriefingPdfService {

  async buildPdf(data: LeadBriefingResponse): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const title = `Pre-call briefing — ${data.leadProfile.name}`;
      const doc = new PDFDocument({
        size: 'A4',
        margin: M,
        info: { Title: title },
      });

      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).fillColor('#111827').text('Pre-call briefing', { continued: false });
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor('#4b5563').text(data.leadProfile.name);
      doc.moveDown(1.2);

      doc.fontSize(12).fillColor('#111827').text('Lead at a glance', { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(10).fillColor('#374151');
      this.line(doc, 'Email', data.leadProfile.email ?? '—');
      this.line(doc, 'Phone', data.leadProfile.phone ?? '—');
      this.line(doc, 'Company', data.leadProfile.company ?? '—');
      this.line(doc, 'Meta / source', data.leadProfile.metaAdSource ?? '—');
      this.line(doc, 'UTM campaign', data.leadProfile.utmCampaign ?? '—');
      this.line(doc, 'Created', new Date(data.leadProfile.createdAt).toLocaleString());
      doc.moveDown(0.8);

      doc.fontSize(12).fillColor('#111827').text('Call details', { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(10).fillColor('#374151');
      this.line(
        doc,
        'Scheduled',
        data.callDetails.scheduledAt
          ? new Date(data.callDetails.scheduledAt).toLocaleString()
          : '—',
      );
      this.line(doc, 'Consultant', data.callDetails.consultantName ?? '—');
      if (data.callDetails.meetingLink) {
        doc.text('Meeting link: ', { continued: true });
        doc.fillColor('#2563eb').text(data.callDetails.meetingLink, { link: data.callDetails.meetingLink });
        doc.fillColor('#374151');
      }
      doc.moveDown(0.8);

      doc.fontSize(12).fillColor('#111827').text('Score breakdown', { underline: true });
      doc.moveDown(0.4);
      for (const d of data.scorecardSummary.dimensions) {
        doc
          .fontSize(10)
          .fillColor('#374151')
          .text(`${d.label}: ${d.score} / ${d.max}`);
      }
      doc.moveDown(0.6);

      doc.fontSize(12).fillColor('#111827').text('Gap areas', { underline: true });
      doc.moveDown(0.4);
      if (!data.scorecardSummary.gapAreas.length) {
        doc.fontSize(10).fillColor('#6b7280').text('None flagged.');
      } else {
        for (const g of data.scorecardSummary.gapAreas) {
          doc.fontSize(10).fillColor('#111827').text(`• ${g.title}`);
          doc.fontSize(9).fillColor('#4b5563').text(g.description, { indent: 10 });
          doc.moveDown(0.3);
        }
      }
      doc.moveDown(0.6);

      doc.fontSize(12).fillColor('#111827').text('WhatsApp (last messages)', { underline: true });
      doc.moveDown(0.4);
      const slice = data.conversationSummary.slice(-5);
      if (!slice.length) {
        doc.fontSize(10).fillColor('#6b7280').text('No bot WhatsApp log found.');
      } else {
        for (const m of slice) {
          const who = m.direction === 'inbound' ? 'Lead' : 'Bot';
          doc
            .fontSize(9)
            .fillColor('#6b7280')
            .text(`${who} · ${new Date(m.timestamp).toLocaleString()}`);
          doc.fontSize(10).fillColor('#111827').text(m.body.slice(0, 500));
          doc.moveDown(0.35);
        }
      }
      doc.moveDown(0.6);

      doc.fontSize(12).fillColor('#111827').text('Talk track', { underline: true });
      doc.moveDown(0.4);
      doc.fontSize(10).fillColor('#111827').text(data.talkTrack, { align: 'left' });

      doc.end();
    });
  }

  private line(doc: InstanceType<typeof PDFDocument>, label: string, value: string) {
    doc.text(`${label}: ${value}`);
  }
}
