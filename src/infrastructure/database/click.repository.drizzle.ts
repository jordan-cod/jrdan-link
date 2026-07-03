import type { NewClick } from '@/domains/click/click.entity';
import type { ClickRepository } from '@/domains/click/click.repository';
import { db } from '@/infrastructure/database/client';
import { clicks } from '@/infrastructure/database/schema';

export const drizzleClickRepository: ClickRepository = {
  async insertMany(events: NewClick[]): Promise<void> {
    await db.insert(clicks).values(events);
  },
};
