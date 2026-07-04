import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';
import type { Queue } from 'bullmq';
import type { Hono } from 'hono';
import { serveStatic } from 'hono/bun';

export function registerQueueBoard(app: Hono, queues: Queue[], basePath: string) {
  const serverAdapter = new HonoAdapter(serveStatic);

  createBullBoard({
    queues: queues.map((queue) => new BullMQAdapter(queue)),
    serverAdapter,
  });

  serverAdapter.setBasePath(basePath);
  app.route(basePath, serverAdapter.registerPlugin());
}
