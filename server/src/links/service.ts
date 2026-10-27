import type { Edge } from '../edge/edge';
import type { Link, LinkRepository } from './repository';
import { generateSlug, normalizeUrl, slugError } from './rules';

const MAX_SLUG_ATTEMPTS = 8;

export interface LinkInput {
	url: string;
	slug?: string | null;
	expiresAt?: string | null;
}

export type LinkResult = { ok: true; link: Link } | { ok: false; status: 400 | 404 | 409 | 502; error: string };

export class LinkService {
	constructor(
		private readonly links: LinkRepository,
		private readonly edge: Edge,
		private readonly shortBaseUrl: string,
		private readonly now: () => Date = () => new Date(),
	) {}

	list(): Link[] {
		return this.links.list();
	}

	shortUrl(slug: string): string {
		return `${this.shortBaseUrl}/${slug}`;
	}

	async create(input: LinkInput): Promise<LinkResult> {
		const normalized = normalizeUrl(input.url, this.shortBaseUrl);
		if ('error' in normalized) return { ok: false, status: 400, error: normalized.error };

		const now = this.now();
		const expiresAt = this.parseExpiry(input.expiresAt, now);
		if (expiresAt === 'invalid') return { ok: false, status: 400, error: 'A expiração precisa ser uma data futura' };

		const slug = input.slug ? input.slug.trim() : this.freeSlug();
		if (!slug) return { ok: false, status: 502, error: 'Não consegui gerar um código livre' };
		const invalid = slugError(slug);
		if (invalid) return { ok: false, status: 400, error: invalid };

		const link: Link = { slug, url: normalized.url, createdAt: now, updatedAt: now, expiresAt };
		if (!this.links.insert(link)) return { ok: false, status: 409, error: 'Esse código já está em uso' };

		try {
			await this.edge.put(link);
		} catch {
			this.links.delete(slug);
			return { ok: false, status: 502, error: 'A Cloudflare não respondeu. O link não foi criado.' };
		}

		return { ok: true, link };
	}

	async update(slug: string, input: LinkInput): Promise<LinkResult> {
		const current = this.links.find(slug);
		if (!current) return { ok: false, status: 404, error: 'Link não encontrado' };

		const normalized = normalizeUrl(input.url, this.shortBaseUrl);
		if ('error' in normalized) return { ok: false, status: 400, error: normalized.error };

		const now = this.now();
		const expiresAt = input.expiresAt === undefined ? current.expiresAt : this.parseExpiry(input.expiresAt, now);
		if (expiresAt === 'invalid') return { ok: false, status: 400, error: 'A expiração precisa ser uma data futura' };

		const next: Link = { ...current, url: normalized.url, expiresAt, updatedAt: now };
		this.links.save(next);

		try {
			await this.edge.put(next);
		} catch {
			this.links.save(current);
			return { ok: false, status: 502, error: 'A Cloudflare não respondeu. Nada foi alterado.' };
		}

		return { ok: true, link: next };
	}

	async remove(slug: string): Promise<LinkResult> {
		const current = this.links.find(slug);
		if (!current) return { ok: false, status: 404, error: 'Link não encontrado' };

		try {
			await this.edge.remove(slug);
		} catch {
			return { ok: false, status: 502, error: 'A Cloudflare não respondeu. O link continua no ar.' };
		}

		this.links.delete(slug);
		return { ok: true, link: current };
	}

	pruneExpired(): string[] {
		return this.links.deleteExpired(this.now());
	}

	private freeSlug(): string | null {
		for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
			const slug = generateSlug();
			if (!this.links.exists(slug)) return slug;
		}
		return null;
	}

	private parseExpiry(value: string | null | undefined, now: Date): Date | null | 'invalid' {
		if (!value) return null;
		const date = new Date(value);
		if (Number.isNaN(date.getTime()) || date <= now) return 'invalid';
		return date;
	}
}
