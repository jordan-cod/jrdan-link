import { bigserial, boolean, index, inet, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { links } from '@/adapters/database/postgresql/schema/link';

export const clicks = pgTable(
  'clicks',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    linkId: text('link_id')
      .notNull()
      .references(() => links.id, { onDelete: 'cascade' }),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    ip: inet('ip'),
    userAgent: text('user_agent'),
    referrer: text('referrer'),
    country: text('country'),
    device: text('device'),
    isBot: boolean('is_bot').notNull().default(false),
  },
  (t) => [index('clicks_link_ts_idx').on(t.linkId, t.ts.desc()), index('clicks_ts_idx').on(t.ts.desc())],
);
