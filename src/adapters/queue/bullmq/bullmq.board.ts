import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';
import { Queue } from 'bullmq';
import type { Hono } from 'hono';
import { serveStatic } from 'hono/bun';

import { redisConnection } from '@/adapters/queue/bullmq/bullmq.connection';

export function registerQueueBoard(app: Hono, queueNames: string[], basePath: string) {
  const serverAdapter = new HonoAdapter(serveStatic);

  createBullBoard({
    queues: queueNames.map((name) => new BullMQAdapter(new Queue(name, { connection: redisConnection }))),
    serverAdapter,
  });

  serverAdapter.setBasePath(basePath);
  app.route(basePath, serverAdapter.registerPlugin());
}
