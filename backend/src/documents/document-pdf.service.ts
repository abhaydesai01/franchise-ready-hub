import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export type PdfSection = { title: string; body: string };

const M = 48;
const BODY_PT = 11;
const HEAD_PT = 14;

@Injectable()
export class DocumentPdfService {
  /**
   * Split model output into sections by Markdown ## / ### headings, or fallback to single block.
   */
  parseSectionsFromModelText(raw: string): PdfSection[] {
    const text = raw.replace(/\r\n/g, '\n').trim();
    if (!text) return [{ title: 'Content', body: '' }];

    const lines = text.split('\n');
    const sections: { title: string; lines: string[] }[] = [];
    let current: { title: string; lines: string[] } | null = null;

    const headingRe = /^(#{1,3})\s+(.+)$/;

    for (const line of lines) {
      const hm = line.match(headingRe);
      if (hm) {
        if (current) sections.push(current);
        current = { title: hm[2].trim(), lines: [] };
      } else {
        if (!current) {
          current = { title: 'Document', lines: [line] };
        } else {
          current.lines.push(line);
        }
      }
    }
    if (current) sections.push(current);

    if (!sections.length) {
      return [{ title: 'Document', body: text }];
    }

    return sections.map((s) => ({
      title: s.title,
      body: s.lines.join('\n').trim(),
    }));
  }

  async buildDocumentPdf(input: {
    title: string;
    sections: PdfSection[];
    companyName: string;
    letterheadLine2?: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'A4',
        margin: M,
        bufferPages: true,
        info: { Title: input.title, Author: input.companyName },
      });

      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      let page = 0;
      doc.on('pageAdded', () => {
        page += 1;
      });

      // Page 1 letterhead
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#111827');
      doc.text(input.companyName, M, M, { width: doc.page.width - 2 * M });
      doc.moveDown(0.3);
      if (input.letterheadLine2) {
        doc.fontSize(9).font('Helvetica').fillColor('#4b5563');
        doc.text(input.letterheadLine2, { width: doc.page.width - 2 * M });
      }
      doc.moveDown(0.2);
      doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(M, doc.y + 4).lineTo(doc.page.width - M, doc.y + 4).stroke();
      doc.moveDown(1.2);

      doc.fontSize(16).font('Helvetica-Bold').fillColor('#111827').text(input.title);
      doc.moveDown(1);

      for (const sec of input.sections) {
        doc.fontSize(HEAD_PT).font('Helvetica-Bold').text(sec.title, { continued: false });
        doc.moveDown(0.35);
        doc.fontSize(BODY_PT).font('Helvetica').fillColor('#111827');
        doc.text(sec.body || ' ', {
          width: doc.page.width - 2 * M,
          align: 'left',
        });
        doc.moveDown(1);
      }

      const range = doc.bufferedPageRange();
      const total = range.count;
      for (let i = 0; i < total; i++) {
        doc.switchToPage(range.start + i);
        const footerY = doc.page.height - 36;
        doc.fontSize(8).font('Helvetica').fillColor('#6b7280');
        doc.text(
          `${input.companyName} | Confidential`,
          M,
          footerY,
          { width: doc.page.width - 2 * M, align: 'center' },
        );
        doc.text(
          `Page ${i + 1} of ${total}`,
          M,
          footerY + 12,
          { width: doc.page.width - 2 * M, align: 'center' },
        );
      }

      doc.end();
    });
  }
}
