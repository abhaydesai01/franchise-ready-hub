import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { AutomationLog } from '@/models/AutomationLog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Database unavailable' }, { status: 500 });
  }

  const { id } = params;
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
  }

  try {
    const rows = await AutomationLog.find({
      leadId: new mongoose.Types.ObjectId(id),
      channel: 'whatsapp',
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json(rows);
  } catch (e) {
    console.error('[leads/whatsapp]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
