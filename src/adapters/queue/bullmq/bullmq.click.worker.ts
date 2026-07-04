import { Worker } from 'bullmq';

import { CLICKS_QUEUE } from '@/adapters/queue/bullmq/bullmq.click.queue';
import { redisConnection } from '@/adapters/queue/bullmq/bullmq.connection';
import type { IClickRepository } from '@/domains/click/click.repository.interface';
import type { NewClick } from '@/domains/click/click.types';
import { logger } from '@/shared/logger/logger';

const CONCURRENCY = 10;

export function startClickWorker(clickRepository: IClickRepository): Worker<NewClick> {
  const worker = new Worker<NewClick>(
    CLICKS_QUEUE,
    async (job) => {
      await clickRepository.insertMany([{ ...job.data, ts: new Date(job.data.ts) }]);
    },
    { connection: redisConnection, concurrency: CONCURRENCY },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'click job failed');
  });

  return worker;
}
