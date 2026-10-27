const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const SLUG_PATTERN = /^[a-zA-Z0-9_-]{2,32}$/;

export const GENERATED_SLUG_LENGTH = 5;

export function generateSlug(length = GENERATED_SLUG_LENGTH): string {
	const limit = 256 - (256 % ALPHABET.length);
	let slug = '';
	while (slug.length < length) {
		const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
		for (const byte of bytes) {
			if (byte >= limit) continue;
			slug += ALPHABET[byte % ALPHABET.length];
			if (slug.length === length) break;
		}
	}
	return slug;
}

export function slugError(slug: string): string | null {
	if (!SLUG_PATTERN.test(slug)) return 'Use de 2 a 32 letras, números, hífen ou underline';
	return null;
}

export function normalizeUrl(input: string, shortBaseUrl: string): { url: string } | { error: string } {
	let parsed: URL;
	try {
		parsed = new URL(input.trim());
	} catch {
		return { error: 'URL inválida' };
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return { error: 'Use um endereço http:// ou https://' };
	}

	if (parsed.origin === new URL(shortBaseUrl).origin) {
		return { error: 'Não dá pra encurtar um link do próprio encurtador' };
	}

	return { url: parsed.toString() };
}
