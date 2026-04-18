import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async listForUser(userId: string) {
    return this.notificationModel
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean<Array<Notification & { _id: string }>>()
      .exec();
  }

  async markAllReadForUser(userId: string) {
    await this.notificationModel
      .updateMany({ userId, read: false }, { $set: { read: true } })
      .exec();
  }

  async notifyUser(input: {
    userId: string;
    type: string;
    description: string;
    leadId?: string;
  }) {
    await this.notificationModel.create({
      userId: input.userId,
      type: input.type,
      description: input.description,
      leadId: input.leadId,
      timestamp: new Date().toISOString(),
      read: false,
    });
  }

  async notifyAdminsAndManagers(input: {
    description: string;
    type: string;
    leadId?: string;
  }) {
    const users = await this.userModel
      .find({ role: { $in: ['admin', 'manager'] } })
      .select('_id')
      .lean<Array<{ _id: { toString: () => string } }>>()
      .exec();

    const ts = new Date().toISOString();
    const docs = users.map((u) => ({
      userId: String(u._id),
      type: input.type,
      description: input.description,
      leadId: input.leadId,
      timestamp: ts,
      read: false,
    }));
    if (docs.length) {
      await this.notificationModel.insertMany(docs);
    }
  }

  async seedDefaultsForUser(userId: string) {
    const count = await this.notificationModel
      .countDocuments({ userId })
      .exec();
    if (count > 0) return;

    const now = new Date().toISOString();
    await this.notificationModel.insertMany([
      {
        userId,
        type: 'lead_added',
        description:
          'Welcome to Franchise Ready CRM — notifications will appear here as activity happens.',
        timestamp: now,
        read: false,
      },
    ]);
  }
}
