import type { NewClick } from '@/domains/click/click.types';

export interface IClickRepository {
  insertMany(clicks: NewClick[]): Promise<void>;
}
