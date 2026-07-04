import { client } from '@/adapters/database/postgresql/postgresql.client';
import { startWorker } from '@/adapters/queue/bullmq/bullmq.worker';
import { buildApp } from '@/app';
import { clickQueue, clickService } from '@/container';
import { CLICKS_QUEUE } from '@/domains/click/click.constants';
import type { NewClick } from '@/domains/click/click.types';
import { config } from '@/shared/config/config';
import { logger } from '@/shared/logger/logger';

await client`SELECT 1`;

const clickWorker = startWorker<NewClick>(CLICKS_QUEUE, (click) => clickService.persistClick(click));

const server = Bun.serve({
  port: config.PORT,
  fetch: buildApp().fetch,
});

logger.info({ port: config.PORT }, 'listening');

async function shutdown() {
  logger.info('shutting down');
  await server.stop();
  await clickWorker.close();
  await clickQueue.close();
  await client.end({ timeout: 5 });
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
