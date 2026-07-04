import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';
import type { OpenAPIHono } from '@hono/zod-openapi';
import { serveStatic } from 'hono/bun';

import { clickQueue } from '@/container';

export const QUEUE_BOARD_PATH = '/admin/queues';

export function registerQueueBoard(app: OpenAPIHono) {
  const serverAdapter = new HonoAdapter(serveStatic);

  createBullBoard({
    queues: [new BullMQAdapter(clickQueue.queue)],
    serverAdapter,
  });

  serverAdapter.setBasePath(QUEUE_BOARD_PATH);
  app.route(QUEUE_BOARD_PATH, serverAdapter.registerPlugin());
}
