import type { NewClick } from '@/domains/click/click.types';

export interface IClickQueue {
  enqueue(click: NewClick): Promise<void>;
}
