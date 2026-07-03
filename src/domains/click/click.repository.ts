import type { NewClick } from '@/domains/click/click.entity';

export interface ClickRepository {
  insertMany(clicks: NewClick[]): Promise<void>;
}
