import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Client, ClientDocument } from './schemas/client.schema';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
  ) {}

  async list() {
    return this.clientModel
      .find()
      .sort({ signedDate: -1 })
      .lean<Array<Client & { _id: string }>>()
      .exec();
  }

  async update(id: string, dto: UpdateClientDto) {
    const client = await this.clientModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean<(Client & { _id: string }) | null>()
      .exec();

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async createFromSignedLead(input: {
    leadId: string;
    name: string;
    program: string;
  }) {
    const existing = await this.clientModel
      .findOne({ leadId: input.leadId })
      .lean<Client & { _id: string }>()
      .exec();
    if (existing) {
      return existing;
    }
    const safe = input.name.replace(/\s+/g, '').slice(0, 6).toUpperCase() || 'CLIENT';
    const created = await this.clientModel.create({
      leadId: input.leadId,
      name: input.name,
      signedDate: new Date().toISOString().split('T')[0],
      program: input.program,
      onboardingStatus: 'Pending',
      onboardingProgress: 0,
      referralCode: `REF-${safe}`,
      referrals: [],
    });
    return created.toObject() as unknown as Client & { _id: string };
  }
}
