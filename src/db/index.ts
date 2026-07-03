import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { config } from '@/config';
import * as schema from '@/db/schema';

export const client = postgres(config.DATABASE_URL, {
  max: 10,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });

export type LinkRow = typeof schema.links.$inferSelect;
