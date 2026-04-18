import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Activity, ActivityDocument } from './schemas/activity.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { CreateActivityDto } from './dto/create-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
  ) {}

  async listForLead(leadId: string) {
    return this.activityModel
      .find({ leadId })
      .sort({ timestamp: -1 })
      .lean<Array<Activity & { _id: string }>>()
      .exec();
  }

  async listAll() {
    return this.activityModel
      .find()
      .sort({ timestamp: -1 })
      .limit(100)
      .lean<Array<Activity & { _id: string }>>()
      .exec();
  }

  async createForLead(leadId: string, dto: CreateActivityDto) {
    const lead = await this.leadModel
      .findById(leadId)
      .lean<(Lead & { _id: string }) | null>()
      .exec();
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const activity = await this.activityModel.create({
      leadId,
      leadName: lead.name,
      type: dto.type,
      description: dto.description,
      addedBy: dto.addedBy,
      timestamp: new Date().toISOString(),
    });

    await this.leadModel
      .findByIdAndUpdate(leadId, {
        $set: {
          lastActivity: 'Just now',
          lastActivityType: dto.type,
        },
      })
      .exec();

    return activity.toObject() as unknown as Activity & { _id: string };
  }

  /** Timeline entry + lead summary for scorecard delivery (Nest scorecard pipeline). */
  async recordScorecardSent(leadId: string) {
    const lead = await this.leadModel
      .findById(leadId)
      .lean<(Lead & { _id: string }) | null>()
      .exec();
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const ts = new Date().toISOString();
    await this.activityModel.create({
      leadId,
      leadName: lead.name,
      type: 'scorecard_generated',
      description:
        'Franchise Readiness Report generated and sent (WhatsApp and email where available).',
      timestamp: ts,
    });

    await this.leadModel
      .findByIdAndUpdate(leadId, {
        $set: {
          lastActivity: 'Scorecard sent',
          lastActivityType: 'scorecard_generated',
        },
      })
      .exec();
  }

  async logVoiceCall(
    leadId: string,
    leadName: string,
    description: string,
    touchLeadSummary = true,
  ) {
    const ts = new Date().toISOString();
    await this.activityModel.create({
      leadId,
      leadName,
      type: 'voice_call',
      description,
      timestamp: ts,
    });
    if (touchLeadSummary) {
      await this.leadModel
        .findByIdAndUpdate(leadId, {
          $set: {
            lastActivity: 'Voice call',
            lastActivityType: 'voice_call',
          },
        })
        .exec();
    }
  }

  async logCalendlyEvent(
    leadId: string,
    type: string,
    description: string,
    touchLeadSummary = true,
  ) {
    const lead = await this.leadModel
      .findById(leadId)
      .lean<(Lead & { _id: string }) | null>()
      .exec();
    if (!lead) return;
    const ts = new Date().toISOString();
    await this.activityModel.create({
      leadId,
      leadName: lead.name,
      type,
      description,
      timestamp: ts,
    });
    if (touchLeadSummary) {
      await this.leadModel
        .findByIdAndUpdate(leadId, {
          $set: {
            lastActivity: 'Just now',
            lastActivityType: type,
          },
        })
        .exec();
    }
  }
}
