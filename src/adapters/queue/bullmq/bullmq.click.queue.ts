import { Queue } from 'bullmq';

import { redisConnection } from '@/adapters/queue/bullmq/bullmq.connection';
import type { IClickQueue } from '@/domains/click/click.queue.interface';
import type { NewClick } from '@/domains/click/click.types';

export const CLICKS_QUEUE = 'clicks';
export const RECORD_CLICK_JOB = 'record-click';

export class BullmqClickQueue implements IClickQueue {
  readonly queue = new Queue<NewClick>(CLICKS_QUEUE, { connection: redisConnection });

  async enqueue(click: NewClick): Promise<void> {
    await this.queue.add(RECORD_CLICK_JOB, click, {
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: 5000,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
