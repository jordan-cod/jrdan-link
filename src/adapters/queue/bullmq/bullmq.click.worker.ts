import { Worker } from 'bullmq';

import { CLICKS_QUEUE } from '@/adapters/queue/bullmq/bullmq.click.queue';
import { redisConnection } from '@/adapters/queue/bullmq/bullmq.connection';
import type { NewClick } from '@/domains/click/click.types';
import { logger } from '@/shared/logger/logger';

const CONCURRENCY = 10;

type ClickHandler = (click: NewClick) => Promise<void>;

// Transporte: escuta a fila, desserializa o job e delega pro handler de domínio.
export function startClickWorker(handler: ClickHandler): Worker<NewClick> {
  const worker = new Worker<NewClick>(
    CLICKS_QUEUE,
    async (job) => {
      await handler({ ...job.data, ts: new Date(job.data.ts) });
    },
    { connection: redisConnection, concurrency: CONCURRENCY },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'click job failed');
  });

  return worker;
}
