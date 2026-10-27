import type { Database } from 'bun:sqlite';
import { randomToken, sha256 } from './secrets';

export const TOKEN_PREFIX = 'jl_';

export interface ApiToken {
	id: string;
	name: string;
	createdAt: Date;
	lastUsedAt: Date | null;
}

interface TokenRow {
	id: string;
	name: string;
	created_at: string;
	last_used_at: string | null;
}

const toToken = (row: TokenRow): ApiToken => ({
	id: row.id,
	name: row.name,
	createdAt: new Date(row.created_at),
	lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
});

export class TokenStore {
	constructor(
		private readonly db: Database,
		private readonly now: () => Date = () => new Date(),
	) {}

	list(): ApiToken[] {
		return this.db
			.query<TokenRow, []>('SELECT id, name, created_at, last_used_at FROM api_tokens ORDER BY created_at DESC')
			.all()
			.map(toToken);
	}

	create(name: string): { token: ApiToken; secret: string } {
		const secret = `${TOKEN_PREFIX}${randomToken()}`;
		const token: ApiToken = { id: crypto.randomUUID(), name, createdAt: this.now(), lastUsedAt: null };
		this.db
			.query('INSERT INTO api_tokens (id, name, token_hash, created_at) VALUES (?, ?, ?, ?)')
			.run(token.id, token.name, sha256(secret), token.createdAt.toISOString());
		return { token, secret };
	}

	verify(secret: string): boolean {
		if (!secret.startsWith(TOKEN_PREFIX)) return false;
		const result = this.db
			.query('UPDATE api_tokens SET last_used_at = ? WHERE token_hash = ?')
			.run(this.now().toISOString(), sha256(secret));
		return result.changes === 1;
	}

	revoke(id: string): boolean {
		return this.db.query('DELETE FROM api_tokens WHERE id = ?').run(id).changes === 1;
	}
}
