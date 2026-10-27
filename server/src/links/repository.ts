import type { Database } from 'bun:sqlite';

export interface Link {
	slug: string;
	url: string;
	createdAt: Date;
	updatedAt: Date;
	expiresAt: Date | null;
}

interface LinkRow {
	slug: string;
	url: string;
	created_at: string;
	updated_at: string;
	expires_at: string | null;
}

const toLink = (row: LinkRow): Link => ({
	slug: row.slug,
	url: row.url,
	createdAt: new Date(row.created_at),
	updatedAt: new Date(row.updated_at),
	expiresAt: row.expires_at ? new Date(row.expires_at) : null,
});

export class LinkRepository {
	constructor(private readonly db: Database) {}

	list(): Link[] {
		return this.db.query<LinkRow, []>('SELECT * FROM links ORDER BY created_at DESC').all().map(toLink);
	}

	find(slug: string): Link | null {
		const row = this.db.query<LinkRow, [string]>('SELECT * FROM links WHERE slug = ?').get(slug);
		return row ? toLink(row) : null;
	}

	exists(slug: string): boolean {
		return this.db.query<{ found: number }, [string]>('SELECT 1 AS found FROM links WHERE slug = ?').get(slug) !== null;
	}

	insert(link: Link): boolean {
		const result = this.db
			.query(
				'INSERT INTO links (slug, url, created_at, updated_at, expires_at) VALUES ($slug, $url, $createdAt, $updatedAt, $expiresAt) ON CONFLICT (slug) DO NOTHING',
			)
			.run({
				slug: link.slug,
				url: link.url,
				createdAt: link.createdAt.toISOString(),
				updatedAt: link.updatedAt.toISOString(),
				expiresAt: link.expiresAt?.toISOString() ?? null,
			});
		return result.changes === 1;
	}

	save(link: Link): void {
		this.db
			.query('UPDATE links SET url = $url, updated_at = $updatedAt, expires_at = $expiresAt WHERE slug = $slug')
			.run({
				slug: link.slug,
				url: link.url,
				updatedAt: link.updatedAt.toISOString(),
				expiresAt: link.expiresAt?.toISOString() ?? null,
			});
	}

	delete(slug: string): void {
		this.db.query('DELETE FROM links WHERE slug = ?').run(slug);
	}

	deleteExpired(now: Date): string[] {
		return this.db
			.query<{ slug: string }, [string]>(
				'DELETE FROM links WHERE expires_at IS NOT NULL AND expires_at <= ? RETURNING slug',
			)
			.all(now.toISOString())
			.map((row) => row.slug);
	}
}
