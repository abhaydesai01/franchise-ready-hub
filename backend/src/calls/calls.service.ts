import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DiscoveryCall, CallDocument } from './schemas/call.schema';
import { UpdateCallDto } from './dto/update-call.dto';

@Injectable()
export class CallsService {
  constructor(
    @InjectModel(DiscoveryCall.name)
    private readonly callModel: Model<CallDocument>,
  ) {}

  async list(params?: { status?: string; date?: string }) {
    const query = this.callModel.find();

    if (params?.status) {
      query.where('status').equals(params.status);
    }

    if (params?.date) {
      query.where('scheduledAt').regex(`^${params.date}`);
    }

    return query
      .sort({ scheduledAt: 1 })
      .lean<Array<DiscoveryCall & { _id: string }>>()
      .exec();
  }

  async update(id: string, dto: UpdateCallDto) {
    const updated = await this.callModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean<(DiscoveryCall & { _id: string }) | null>()
      .exec();

    if (!updated) {
      throw new NotFoundException('Call not found');
    }

    return updated;
  }
}
