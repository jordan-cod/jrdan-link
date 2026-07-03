import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { clicks } from '@/adapters/database/postgresql/schema/click';
import { links } from '@/adapters/database/postgresql/schema/link';
import { config } from '@/shared/config/config';

export const client = postgres(config.DATABASE_URL, {
  max: 10,
  onnotice: () => {},
});

export const db = drizzle(client, { schema: { links, clicks } });
