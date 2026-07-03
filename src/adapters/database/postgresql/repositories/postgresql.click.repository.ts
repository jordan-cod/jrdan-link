import { db } from '@/adapters/database/postgresql/postgresql.client';
import { clicks } from '@/adapters/database/postgresql/schema/click';

import type { IClickRepository } from '@/domains/click/click.repository.interface';
import type { NewClick } from '@/domains/click/click.types';

export class PostgresqlClickRepository implements IClickRepository {
  async insertMany(events: NewClick[]): Promise<void> {
    await db.insert(clicks).values(events);
  }
}
