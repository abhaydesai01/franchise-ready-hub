/**
 * After `nest build`:
 *   REDIS_URL=... MONGODB_URI=... ANTHROPIC_API_KEY=... PUBLIC_BASE_URL=... \
 *   node dist/documents/document-generation.worker.js
 */
import { NestFactory } from '@nestjs/core';
import { Worker } from 'bullmq';
import { createBullConnection } from '../queues/redis-connection';
import { DocumentGenerationWorkerModule } from './document-generation.worker.module';
import { DocumentGenerationService } from './document-generation.service';

export type GenerateDocumentJobData = {
  leadId: string;
  documentType: 'proposal' | 'mom';
};

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');

  const app = await NestFactory.createApplicationContext(
    DocumentGenerationWorkerModule,
    { logger: ['error', 'warn', 'log'] },
  );
  const gen = app.get(DocumentGenerationService);

  const connection = createBullConnection('document-generation-worker');

  const worker = new Worker(
    'document-generation',
    async (job) => {
      if (job.name !== 'GENERATE_DOCUMENT') return;
      const data = job.data as GenerateDocumentJobData;
      await gen.runGenerateJob(data.leadId, data.documentType);
    },
    { connection, concurrency: 2 },
  );

  worker.on('failed', (job, err) => {
    console.error('[document-generation] job failed', job?.id, err);
  });

  console.log('[document-generation] worker listening');
}

void run().catch((e) => {
  console.error(e);
  process.exit(1);
});
