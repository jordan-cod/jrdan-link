import postgres from 'postgres';

import { config } from '@/config';

export const sql = postgres(config.DATABASE_URL, {
  max: 10,
  onnotice: () => {},
});

export interface LinkRow {
  id: string;
  url: string;
  created_at: Date;
  expires_at: Date | null;
  active: boolean;
}
