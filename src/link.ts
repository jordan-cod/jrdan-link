/** Regras de um link. Sem I/O, então testa sozinho. */

export interface Link {
  slug: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
}

export const SLUG_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;

/** Base58: sem 0/O/1/l/I, que se confundem quando o link é lido em voz alta. */
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 5;

/** Caminhos que o navegador pede sozinho e que ninguém pode registrar. */
const RESERVED = new Set(['favicon.ico', 'robots.txt', 'sitemap.xml']);

/** Valida e normaliza uma URL. Só aceita http/https; null se inválida. */
export function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;

  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  return parsed.toString();
}

/** Retorna a mensagem de erro, ou null se o slug é válido. */
export function validateSlug(slug: string): string | null {
  if (RESERVED.has(slug.toLowerCase())) return 'Esse slug é reservado';
  if (!SLUG_PATTERN.test(slug)) {
    return 'Slug deve ter 3-32 caracteres entre letras, números, hífen e underscore';
  }
  return null;
}

/** Segundos até expirar. Retorna a mensagem de erro, ou null. */
export function validateExpiresIn(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return 'expiresIn deve ser um número inteiro positivo de segundos';
  }
  return null;
}

export function generateSlug(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}

export function shortUrl(origin: string, slug: string): string {
  return `${origin}/${slug}`;
}
