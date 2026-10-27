import type { Database } from 'bun:sqlite';
import { randomToken, sha256 } from './secrets';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class SessionStore {
	constructor(
		private readonly db: Database,
		private readonly now: () => Date = () => new Date(),
	) {}

	create(login: string): { token: string; expiresAt: Date } {
		const token = randomToken();
		const now = this.now();
		const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
		this.db
			.query('INSERT INTO sessions (id_hash, login, created_at, expires_at) VALUES (?, ?, ?, ?)')
			.run(sha256(token), login, now.toISOString(), expiresAt.toISOString());
		return { token, expiresAt };
	}

	login(token: string): string | null {
		const row = this.db
			.query<{ login: string }, [string, string]>('SELECT login FROM sessions WHERE id_hash = ? AND expires_at > ?')
			.get(sha256(token), this.now().toISOString());
		return row?.login ?? null;
	}

	revoke(token: string): void {
		this.db.query('DELETE FROM sessions WHERE id_hash = ?').run(sha256(token));
	}

	pruneExpired(): void {
		this.db.query('DELETE FROM sessions WHERE expires_at <= ?').run(this.now().toISOString());
	}
}
