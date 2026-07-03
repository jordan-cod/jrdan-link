import { InvalidUrlError } from '@/domains/link/link.errors';

export function validateUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InvalidUrlError();
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new InvalidUrlError();
  if (!url.hostname) throw new InvalidUrlError();
}
