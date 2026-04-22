/**
 * One-shot cleanup:
 *  - Deletes E2E-test sessions/conversations (phones 919990000009–099)
 *  - Fixes any lead/session where the name was misclassified as a greeting
 *    (e.g. "Hello", "Hi", "Yes") by resetting to "WhatsApp lead" so the next
 *    inbound message upgrades it to the real WhatsApp profile name.
 *  - Drops legacy freddy_bot collections (freddy_sessions / freddy_messages).
 *
 * Usage (from crm/):
 *   node -r dotenv/config node_modules/.bin/tsx scripts/cleanup-stale-freddy-data.ts dotenv_config_path=.env.local
 */
import mongoose from 'mongoose';

const STALE_NAMES = [
  '', 'whatsapp lead', 'hi', 'hello', 'hey', 'heya', 'hii', 'hiya', 'hai', 'helo', 'hlw', 'hola',
  'yes', 'yeah', 'yep', 'yup', 'sure', 'okay', 'ok', 'great', 'alright',
  'no', 'nope', 'nah',
  'thanks', 'thank you', 'thx', 'ty',
  'test', 'testing',
];

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;

  const testPhonePrefix = /^91999000/;

  const testSessions = await db.collection('botsessions').find({ phone: { $regex: testPhonePrefix } }).toArray();
  const testLeadIds = testSessions.map((s) => s.leadId).filter(Boolean);
  const testPhones = testSessions.map((s) => s.phone as string);

  const d1 = await db.collection('botsessions').deleteMany({ phone: { $regex: testPhonePrefix } });
  const d2 = await db.collection('conversations').deleteMany({
    $or: [{ leadId: { $in: testLeadIds } }, { phone: { $in: testPhones } }],
  });
  const d3 = await db.collection('leads').deleteMany({ _id: { $in: testLeadIds } });

  console.log(`[cleanup] removed ${d1.deletedCount} test botsessions`);
  console.log(`[cleanup] removed ${d2.deletedCount} test conversations`);
  console.log(`[cleanup] removed ${d3.deletedCount} test leads`);

  const staleNameRegex = new RegExp(`^(${STALE_NAMES.filter(Boolean).join('|')})$`, 'i');

  const u1 = await db.collection('botsessions').updateMany(
    { collectedName: { $regex: staleNameRegex } },
    { $set: { collectedName: 'WhatsApp lead' }, $unset: { 'goalTracker.has_name': '' } },
  );
  const u2 = await db.collection('leads').updateMany(
    { name: { $regex: staleNameRegex }, source: 'whatsapp_inbound' },
    { $set: { name: 'WhatsApp lead' } },
  );

  console.log(`[cleanup] reset ${u1.modifiedCount} botsessions with stale collectedName`);
  console.log(`[cleanup] reset ${u2.modifiedCount} leads with stale name`);

  for (const name of ['freddy_sessions', 'freddy_messages']) {
    try {
      const count = await db.collection(name).countDocuments();
      if (count > 0) {
        await db.collection(name).drop();
        console.log(`[cleanup] dropped ${name} (${count} docs)`);
      }
    } catch {
      // collection may not exist
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
