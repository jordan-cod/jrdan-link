import { client } from '@/adapters/database/postgresql/postgresql.client';
import { startClickWorker } from '@/adapters/queue/bullmq/bullmq.click.worker';
import { buildApp } from '@/app';
import { clickQueue, clickService } from '@/container';
import { config } from '@/shared/config/config';
import { logger } from '@/shared/logger/logger';

await client`SELECT 1`;

const clickWorker = startClickWorker((click) => clickService.persistClick(click));

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
