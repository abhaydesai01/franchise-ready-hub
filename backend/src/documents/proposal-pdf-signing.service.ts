import { Injectable } from '@nestjs/common';
import { PDFDocument, rgb } from 'pdf-lib';

export type SignBox = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

@Injectable()
export class ProposalPdfSigningService {
  /** Adds a visible signature area on the last page (bottom-left). */
  async addSigningPlaceholder(pdfBytes: Buffer): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    if (!pages.length) {
      throw new Error('PDF has no pages');
    }
    const page = pages[pages.length - 1];
    const box = this.computeSignBox(page);
    page.drawRectangle({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      borderColor: rgb(0.65, 0.65, 0.65),
      borderWidth: 1,
    });
    page.drawText('Sign here', {
      x: box.x + 4,
      y: box.y + box.height - 12,
      size: 9,
      color: rgb(0.2, 0.2, 0.2),
    });
    const out = await pdfDoc.save();
    return Buffer.from(out);
  }

  computeSignBox(page: {
    getSize: () => { width: number; height: number };
  }): SignBox {
    const { width: _w, height: _h } = page.getSize();
    const boxW = 220;
    const boxH = 70;
    const margin = 48;
    return {
      pageIndex: 0,
      x: margin,
      y: margin,
      width: boxW,
      height: boxH,
    };
  }

  async embedSignatureAndTimestamp(
    pdfBytes: Buffer,
    pngBytes: Buffer,
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const page = pages[pages.length - 1];
    const box = this.computeSignBox(page);
    const png = await pdfDoc.embedPng(pngBytes);
    page.drawImage(png, {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
    const ts = new Date().toISOString();
    page.drawText(`Signed: ${ts}`, {
      x: box.x,
      y: Math.max(12, box.y - 14),
      size: 8,
      color: rgb(0.15, 0.15, 0.15),
    });
    const out = await pdfDoc.save();
    return Buffer.from(out);
  }
}
