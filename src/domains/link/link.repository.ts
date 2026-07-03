import { and, desc, eq } from 'drizzle-orm';

import { db, type LinkRow } from '@/db';
import { links } from '@/db/schema';

export type NewLink = typeof links.$inferInsert;
export type LinkPatch = Partial<Pick<NewLink, 'url' | 'expiresAt' | 'active'>>;

export const linkRepository = {
  async findActiveById(id: string): Promise<LinkRow | undefined> {
    const rows = await db
      .select()
      .from(links)
      .where(and(eq(links.id, id), eq(links.active, true)));
    return rows[0];
  },

  async findById(id: string): Promise<LinkRow | undefined> {
    const rows = await db.select().from(links).where(eq(links.id, id));
    return rows[0];
  },

  async insert(link: NewLink): Promise<LinkRow> {
    const rows = await db.insert(links).values(link).returning();
    return rows[0]!;
  },

  async update(id: string, patch: LinkPatch): Promise<LinkRow | undefined> {
    const rows = await db.update(links).set(patch).where(eq(links.id, id)).returning();
    return rows[0];
  },

  async deactivate(id: string): Promise<void> {
    await db.update(links).set({ active: false }).where(eq(links.id, id));
  },

  async list(limit: number, offset: number): Promise<LinkRow[]> {
    return db.select().from(links).orderBy(desc(links.createdAt)).limit(limit).offset(offset);
  },
};
