import { Hono } from 'hono';

import { registerQueueBoard } from '@/adapters/queue/bullmq/bullmq.board';
import { BullmqClickQueue } from '@/adapters/queue/bullmq/bullmq.click.queue';
import { config } from '@/shared/config/config';
import { logger } from '@/shared/logger/logger';

const app = new Hono();
const clickQueue = new BullmqClickQueue();

registerQueueBoard(app, [clickQueue.queue], '/');

Bun.serve({
  port: config.PORT,
  fetch: app.fetch,
});

logger.info({ port: config.PORT }, 'queue dashboard listening');
