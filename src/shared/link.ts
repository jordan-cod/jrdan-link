export interface LinkMetadata {
  url: string;
  createdAt: string;
}

export function shortUrl(baseUrl: string, id: string): string {
  return `${baseUrl}/${id}`;
}
