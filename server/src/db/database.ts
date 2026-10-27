import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const MIGRATIONS = [
	`CREATE TABLE links (
		slug TEXT PRIMARY KEY,
		url TEXT NOT NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL,
		expires_at TEXT
	);
	CREATE INDEX links_created_at ON links (created_at DESC);

	CREATE TABLE sessions (
		id_hash TEXT PRIMARY KEY,
		login TEXT NOT NULL,
		created_at TEXT NOT NULL,
		expires_at TEXT NOT NULL
	);

	CREATE TABLE api_tokens (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		token_hash TEXT NOT NULL UNIQUE,
		created_at TEXT NOT NULL,
		last_used_at TEXT
	);`,
	`CREATE TABLE clicks (
		id TEXT PRIMARY KEY,
		slug TEXT NOT NULL,
		at TEXT NOT NULL,
		country TEXT NOT NULL,
		region_code TEXT NOT NULL,
		region TEXT NOT NULL,
		city TEXT NOT NULL,
		latitude REAL,
		longitude REAL,
		referrer TEXT NOT NULL,
		device TEXT NOT NULL,
		weight INTEGER NOT NULL DEFAULT 1
	);
	CREATE INDEX clicks_at ON clicks (at);
	CREATE INDEX clicks_slug_at ON clicks (slug, at);

	CREATE TABLE sync_state (
		name TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);`,
];

export function openDatabase(path: string): Database {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

	const db = new Database(path, { strict: true, create: true });
	db.exec('PRAGMA journal_mode = WAL');
	db.exec('PRAGMA foreign_keys = ON');
	db.exec('PRAGMA busy_timeout = 5000');
	migrate(db);
	return db;
}

function migrate(db: Database): void {
	const row = db.query<{ user_version: number }, []>('PRAGMA user_version').get();
	const current = row?.user_version ?? 0;

	for (let version = current; version < MIGRATIONS.length; version++) {
		const migration = MIGRATIONS[version];
		if (!migration) continue;
		db.transaction(() => {
			db.exec(migration);
			db.exec(`PRAGMA user_version = ${version + 1}`);
		})();
	}
}
