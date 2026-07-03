import { config } from '@/config';
import { sql } from '@/db';
import { batcher } from '@/domains/click/click.batcher';
import { buildApp } from '@/http/app';

await sql`SELECT 1`;

batcher.start();

const server = Bun.serve({
  port: config.PORT,
  fetch: buildApp().fetch,
});

console.log(JSON.stringify({ msg: 'listening', port: config.PORT }));

async function shutdown() {
  console.log(JSON.stringify({ msg: 'shutting down' }));
  await server.stop();
  await batcher.close();
  await sql.end({ timeout: 5 });
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
