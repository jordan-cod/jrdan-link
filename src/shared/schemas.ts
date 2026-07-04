import { z } from 'zod';

const httpUrl = z.string().refine((value) => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}, 'url must be a valid http(s) URL');

export const createLinkSchema = z.object({
  url: httpUrl,
  slug: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{3,32}$/)
    .optional(),
  expiresIn: z.number().int().positive().optional(),
});

export const updateLinkSchema = z.object({ url: httpUrl });
