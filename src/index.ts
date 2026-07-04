import { client } from '@/adapters/database/postgresql/postgresql.client';
import { buildApp } from '@/app';
import { clickBatcher } from '@/container';
import { config } from '@/shared/config/config';
import { logger } from '@/shared/logger/logger';

await client`SELECT 1`;

clickBatcher.start();

const server = Bun.serve({
  port: config.PORT,
  fetch: buildApp().fetch,
});

logger.info({ port: config.PORT }, 'listening');

async function shutdown() {
  logger.info('shutting down');
  await server.stop();
  await clickBatcher.close();
  await client.end({ timeout: 5 });
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
