import { Hono } from 'hono';

import { registerQueueBoard } from '@/adapters/queue/bullmq/bullmq.board';
import { CLICKS_QUEUE } from '@/domains/click/click.constants';
import { config } from '@/shared/config/config';
import { logger } from '@/shared/logger/logger';

const app = new Hono();

registerQueueBoard(app, [CLICKS_QUEUE], '/');

Bun.serve({
  port: config.PORT,
  fetch: app.fetch,
});

logger.info({ port: config.PORT }, 'queue dashboard listening');
