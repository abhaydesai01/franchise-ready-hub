import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import PDFDocument from 'pdfkit';
import { Proposal, ProposalDocument } from './schemas/proposal.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Client, ClientDocument } from '../clients/schemas/client.schema';
import { CreateProposalDto } from './dto/create-proposal.dto';

@Injectable()
export class ProposalsService {
  constructor(
    @InjectModel(Proposal.name)
    private readonly proposalModel: Model<ProposalDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
  ) {}

  async list(params?: { status?: string; leadId?: string }) {
    const query = this.proposalModel.find();

    if (params?.status && params.status !== 'All') {
      query.where('status').equals(params.status);
    }

    if (params?.leadId) {
      query.where('leadId').equals(params.leadId);
    }

    return query
      .sort({ createdAt: -1 })
      .lean<Array<Proposal & { _id: string }>>()
      .exec();
  }

  async create(dto: CreateProposalDto) {
    const lead = await this.leadModel
      .findById(dto.leadId)
      .lean<(Lead & { _id: string }) | null>()
      .exec();

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const content = this.buildProposalHtml({
      program: dto.program,
      leadName: lead.name,
      score: lead.score,
      callNotes: dto.callNotes,
    });

    const created = await this.proposalModel.create({
      leadId: dto.leadId,
      leadName: lead.name,
      track: lead.track,
      program: dto.program,
      status: 'Draft',
      content,
      createdAt: new Date().toISOString().split('T')[0],
      sentAt: null,
      openedAt: null,
      signedAt: null,
    });

    return created.toObject() as unknown as Proposal & { _id: string };
  }

  async updateStatus(id: string, status: string) {
    const update: Partial<Proposal> = { status };
    const today = new Date().toISOString().split('T')[0];

    if (status === 'Sent') {
      update.sentAt = today;
    }

    if (status === 'Opened') {
      update.openedAt = today;
    }

    if (status === 'Signed') {
      update.signedAt = today;
    }

    const proposal = await this.proposalModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .lean<(Proposal & { _id: string }) | null>()
      .exec();

    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (status === 'Signed') {
      await this.syncClientFromProposal(proposal);
    }

    return proposal;
  }

  async sendViaWhatsApp(id: string) {
    const proposal = await this.proposalModel
      .findById(id)
      .lean<(Proposal & { _id: string }) | null>()
      .exec();
    if (!proposal) throw new NotFoundException('Proposal not found');

    const updated = await this.updateStatus(id, 'Sent');
    return {
      ok: true,
      channel: 'whatsapp',
      message: `Proposal queued for WhatsApp to ${proposal.leadName}`,
      proposal: updated,
    };
  }

  async sendViaEmail(id: string) {
    const proposal = await this.proposalModel
      .findById(id)
      .lean<(Proposal & { _id: string }) | null>()
      .exec();
    if (!proposal) throw new NotFoundException('Proposal not found');

    const updated = await this.updateStatus(id, 'Sent');
    return {
      ok: true,
      channel: 'email',
      message: `Proposal queued for email to ${proposal.leadName}`,
      proposal: updated,
    };
  }

  async getPdfBuffer(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const proposal = await this.proposalModel
      .findById(id)
      .lean<(Proposal & { _id: string }) | null>()
      .exec();
    if (!proposal) throw new NotFoundException('Proposal not found');

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fontSize(18).text(`Proposal: ${proposal.program}`, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Lead: ${proposal.leadName}`);
    doc.text(`Track: ${proposal.track}`);
    doc.text(`Status: ${proposal.status}`);
    doc.text(`Created: ${proposal.createdAt}`);
    doc.moveDown();
    doc.fontSize(14).text('Content');
    doc.moveDown(0.3);
    const plain = proposal.content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    doc.fontSize(11).text(plain || 'No content', { align: 'left' });
    doc.end();

    const buffer = await done;
    const safeName = proposal.leadName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return {
      buffer,
      filename: `proposal-${safeName || String(proposal._id)}.pdf`,
    };
  }

  private async syncClientFromProposal(proposal: Proposal & { _id: string }) {
    const existingClient = await this.clientModel
      .findOne({ leadId: proposal.leadId })
      .exec();

    if (existingClient) {
      await this.clientModel
        .findByIdAndUpdate(existingClient.id, {
          $set: {
            name: proposal.leadName,
            program: proposal.program,
            signedDate: proposal.signedAt ?? proposal.createdAt,
          },
        })
        .exec();
      return;
    }

    await this.clientModel.create({
      leadId: proposal.leadId,
      name: proposal.leadName,
      signedDate: proposal.signedAt ?? proposal.createdAt,
      program: proposal.program,
      onboardingStatus: 'Pending',
      onboardingProgress: 0,
      referralCode: `REF-${proposal.leadName.replace(/\s+/g, '').slice(0, 6).toUpperCase()}`,
      referrals: [],
    });
  }

  private buildProposalHtml(params: {
    program: string;
    leadName: string;
    score: number;
    callNotes: string;
  }) {
    const duration =
      params.program === 'Franchise Ready'
        ? '3-month'
        : params.program === 'Franchise Launch'
          ? '6-month'
          : '12-month';

    return `<h2>${params.program} Program — ${params.leadName}</h2><p>Based on your discovery call and franchise score of ${params.score}/100, we recommend the ${params.program} program.</p><h3>Call Notes</h3><p>${params.callNotes || 'No call notes provided.'}</p><h3>Key Highlights</h3><ul><li>Personalized franchise matching</li><li>Due diligence support</li><li>Negotiation assistance</li><li>Post-launch support</li></ul><h3>Investment & Timeline</h3><p>${duration} engagement with dedicated consultant support.</p><h3>Next Steps</h3><p>1. Review and sign this proposal<br/>2. Complete onboarding documentation<br/>3. Begin franchise discovery phase</p>`;
  }
}
