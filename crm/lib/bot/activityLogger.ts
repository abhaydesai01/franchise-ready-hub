import mongoose from 'mongoose';
import { Activity } from '@/models/Activity';

export async function logWhatsAppActivity(params: {
  leadId: mongoose.Types.ObjectId;
  direction: 'inbound' | 'outbound';
  body: string;
  botState?: string;
  waMessageId?: string | null;
}): Promise<void> {
  try {
    await Activity.create({
      leadId: params.leadId,
      activityType: 'whatsapp',
      direction: params.direction,
      body: params.body,
      botState: params.botState,
      waMessageId: params.waMessageId ?? undefined,
      timestamp: new Date(),
    });
  } catch (e) {
    console.error('[activityLogger] failed', e);
  }
}
