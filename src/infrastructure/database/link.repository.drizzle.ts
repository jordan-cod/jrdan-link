import { and, desc, eq } from 'drizzle-orm';

import type { Link, LinkPatch, NewLink } from '@/domains/link/link.entity';
import type { LinkRepository } from '@/domains/link/link.repository';
import { db } from '@/infrastructure/database/client';
import { links } from '@/infrastructure/database/schema';

export const drizzleLinkRepository: LinkRepository = {
  async findActiveById(id: string): Promise<Link | undefined> {
    const rows = await db
      .select()
      .from(links)
      .where(and(eq(links.id, id), eq(links.active, true)));
    return rows[0];
  },

  async findById(id: string): Promise<Link | undefined> {
    const rows = await db.select().from(links).where(eq(links.id, id));
    return rows[0];
  },

  async insert(link: NewLink): Promise<Link> {
    const rows = await db.insert(links).values(link).returning();
    return rows[0]!;
  },

  async update(id: string, patch: LinkPatch): Promise<Link | undefined> {
    const rows = await db.update(links).set(patch).where(eq(links.id, id)).returning();
    return rows[0];
  },

  async deactivate(id: string): Promise<void> {
    await db.update(links).set({ active: false }).where(eq(links.id, id));
  },

  async list(limit: number, offset: number): Promise<Link[]> {
    return db.select().from(links).orderBy(desc(links.createdAt)).limit(limit).offset(offset);
  },
};
