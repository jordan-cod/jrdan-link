import { Queue as BullmqLibQueue } from 'bullmq';

import { redisConnection } from '@/adapters/queue/bullmq/bullmq.connection';
import type { Queue } from '@/adapters/queue/queue.interface';

const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: 5000,
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 1000 },
};

export class BullmqQueue<TName extends string, TData> implements Queue<TName, TData> {
  readonly queue: BullmqLibQueue;

  constructor(name: string) {
    this.queue = new BullmqLibQueue(name, { connection: redisConnection });
  }

  async enqueue(jobName: TName, data: TData): Promise<void> {
    await this.queue.add(jobName, data, DEFAULT_JOB_OPTIONS);
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
