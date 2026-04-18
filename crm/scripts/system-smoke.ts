/**
 * Full-system smoke: logic always; Mongo + Redis when env is set.
 * Run: npm run test:system
 */
import crypto from 'crypto';
import assert from 'node:assert/strict';

async function main() {
  console.log('--- Franchise Ready CRM smoke ---\n');

  // 1) Webhook signature (META_APP_SECRET)
  const secret = process.env.META_APP_SECRET || '__smoke_test_secret__';
  process.env.META_APP_SECRET = secret;
  const { verifyWebhookSignature } = await import('../lib/whatsapp');
  const rawBody = '{"object":"whatsapp_business_account","entry":[]}';
  const goodSig = `sha256=${crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
  assert.equal(verifyWebhookSignature(rawBody, goodSig), true);
  assert.equal(verifyWebhookSignature(rawBody, 'sha256=deadbeef'), false);
  console.log('[ok] verifyWebhookSignature');

  // 2) formatPhone
  const { formatPhone } = await import('../lib/whatsapp');
  assert.equal(formatPhone('+91 98765 43210'), '919876543210');
  assert.equal(formatPhone('9876543210'), '919876543210');
  console.log('[ok] formatPhone');

  // 3) Scoring guards
  const { isValidScoringReply, isScoringState } = await import('../lib/bot/scoringGuards');
  assert.equal(isScoringState('SCORING_Q1'), true);
  assert.equal(isValidScoringReply('SCORING_Q1', { type: 'interactive', listReplyId: 'cap_3' }), true);
  assert.equal(isValidScoringReply('SCORING_Q1', { type: 'text', text: 'What is this?' }), false);
  assert.equal(isValidScoringReply('SCORING_Q3', { type: 'interactive', buttonId: 'loc_2' }), true);
  assert.equal(isValidScoringReply('SCORING_Q3', { type: 'text', text: 'hello' }), false);
  console.log('[ok] scoringGuards');

  // 4) Templates exports
  const { templates, isTemplateInteractive } = await import('../lib/bot/templates');
  assert.equal(templates.scoringFreetextHelper().type, 'text');
  assert.equal(isTemplateInteractive(templates.scoringQ1b()), true);
  console.log('[ok] templates');

  // 5) MongoDB (optional)
  if (process.env.MONGODB_URI) {
    const { connectDB } = await import('../lib/mongodb');
    const { Lead } = await import('../models/Lead');
    const { BotSession } = await import('../models/BotSession');
    const { AutomationLog } = await import('../models/AutomationLog');
    await connectDB();
    await Promise.all([Lead.countDocuments(), BotSession.countDocuments(), AutomationLog.countDocuments()]);
    console.log('[ok] MongoDB connected + model queries');
  } else {
    console.log('[skip] MONGODB_URI not set — Mongo not tested');
  }

  // 6) Redis / BullMQ connection (optional)
  const redisUrl = process.env.REDIS_URL?.trim() || process.env.UPSTASH_REDIS_URL?.trim();
  if (redisUrl?.startsWith('redis')) {
    const { createBullConnection } = await import('../lib/queues/connection');
    const redis = createBullConnection();
    const pong = await redis.ping();
    assert.equal(pong, 'PONG');
    await redis.quit();
    console.log('[ok] Redis PING');
  } else {
    console.log('[skip] REDIS_URL / UPSTASH_REDIS_URL not set — Redis not tested');
  }

  // 7) BullMQ queue registration (optional, requires Redis)
  if (redisUrl?.startsWith('redis')) {
    const { scoringNudgeQueue, nurtureQueue } = await import('../lib/queues/index');
    const q1 = scoringNudgeQueue();
    const q2 = nurtureQueue();
    const [c1, c2] = await Promise.all([q1.getJobCounts('waiting', 'delayed'), q2.getJobCounts('waiting', 'delayed')]);
    assert.ok(typeof c1 === 'object');
    assert.ok(typeof c2 === 'object');
    console.log('[ok] BullMQ queues instantiated');
  }

  console.log('\n--- All smoke checks passed ---');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
