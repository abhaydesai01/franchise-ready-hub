/**
 * REDIS_URL=... MONGODB_URI=... node dist/documents/proposal-followup.worker.js
 */
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { createBullConnection } from '../queues/redis-connection';
import { ProposalFollowupWorkerModule } from './proposal-followup.worker.module';
import { ProposalFollowupRunnerService } from './proposal-followup-runner.service';
import type { ProposalFollowupJobData } from './proposal-followup-queue.service';

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');

  const app = await NestFactory.createApplicationContext(
    ProposalFollowupWorkerModule,
    { logger: ['error', 'warn', 'log'] },
  );
  const runner = app.get(ProposalFollowupRunnerService);

  const connection = createBullConnection('proposal-followup-worker');

  const worker = new Worker(
    'proposal-followup',
    async (job) => {
      const data = job.data as ProposalFollowupJobData;
      if (job.name === 'PROPOSAL_CHECKIN_48H') {
        await runner.runCheckin48h(data);
        return;
      }
      if (job.name === 'PROPOSAL_ESCALATE_7D') {
        await runner.runEscalate7d(data);
        return;
      }
    },
    { connection, concurrency: 2 },
  );

  worker.on('failed', (job, err) => {
    console.error('[proposal-followup] job failed', job?.id, err);
  });

  console.log('[proposal-followup] worker listening');
}

void run().catch((e) => {
  console.error(e);
  process.exit(1);
});
