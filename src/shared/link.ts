export interface LinkMetadata {
  url: string;
  createdAt: string;
}

export const REDIRECT_BASE_URL = 'https://jrdan.link';

export function shortUrl(id: string): string {
  return `${REDIRECT_BASE_URL}/${id}`;
}
