import { Hono } from 'hono';

import { registerQueueBoard } from '@/adapters/queue/bullmq/bullmq.board';
import { BullmqQueue } from '@/adapters/queue/bullmq/bullmq.queue';
import { CLICKS_QUEUE } from '@/domains/click/click.constants';
import type { NewClick } from '@/domains/click/click.types';
import { config } from '@/shared/config/config';
import { logger } from '@/shared/logger/logger';

const app = new Hono();
const clickQueue = new BullmqQueue<'record-click', NewClick>(CLICKS_QUEUE);

registerQueueBoard(app, [clickQueue.queue], '/');

Bun.serve({
  port: config.PORT,
  fetch: app.fetch,
});

logger.info({ port: config.PORT }, 'queue dashboard listening');
