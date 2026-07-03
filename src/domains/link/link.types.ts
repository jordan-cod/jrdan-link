import type { z } from '@hono/zod-openapi';

import type { createLinkSchema, listLinksQuerySchema, updateLinkSchema } from '@/domains/link/link.schema';

export interface Link {
  id: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
  active: boolean;
}

export interface NewLink {
  id: string;
  url: string;
  expiresAt?: Date;
}

export interface LinkPatch {
  url?: string;
  expiresAt?: Date;
  active?: boolean;
}

export type CreateLinkInput = z.infer<typeof createLinkSchema>;
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>;
export type ListLinksInput = z.infer<typeof listLinksQuerySchema>;
