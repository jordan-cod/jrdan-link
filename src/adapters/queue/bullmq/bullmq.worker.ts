import { Worker } from 'bullmq';

import { redisConnection } from '@/adapters/queue/bullmq/bullmq.connection';
import { logger } from '@/shared/logger/logger';

const DEFAULT_CONCURRENCY = 10;

// Transporte genérico: escuta uma queue e delega cada job pro handler de domínio.
export function startWorker<TData>(
  queueName: string,
  handler: (data: TData) => Promise<void>,
  concurrency = DEFAULT_CONCURRENCY,
): Worker<TData> {
  const worker = new Worker<TData>(queueName, async (job) => handler(job.data), {
    connection: redisConnection,
    concurrency,
  });

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id, queue: queueName }, 'job failed');
  });

  return worker;
}
