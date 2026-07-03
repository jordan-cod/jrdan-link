import { bigserial, boolean, index, inet, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const links = pgTable('links', {
  id: text('id').primaryKey(),
  url: text('url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
});

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
