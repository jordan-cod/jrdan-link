/**
 * Fakes de D1 e KV. Só os testes importam este módulo — nenhum worker o
 * referencia, então ele não entra em bundle nenhum.
 */

import { Database } from 'bun:sqlite';

/**
 * D1 é SQLite, então o fake roda o SQL de verdade em cima do `bun:sqlite` — e
 * lê o schema do próprio arquivo de migração, pra um `ALTER TABLE` esquecido
 * quebrar aqui em vez de no deploy.
 */
const schema = await Bun.file(`${import.meta.dir}/../migrations/0001_init.sql`).text();

export function fakeD1(): D1Database {
  const db = new Database(':memory:');
  db.run(schema);

  const statement = (sql: string, params: unknown[]) => ({
    bind: (...bound: unknown[]) => statement(sql, bound),
    first: async () => db.query(sql).get(...(params as never[])) ?? null,
    run: async () => ({ meta: { changes: db.run(sql, params as never[]).changes } }),
    all: async () => ({ results: db.query(sql).all(...(params as never[])) }),
  });

  return { prepare: (sql: string) => statement(sql, []) } as unknown as D1Database;
}

export class FakeKv {
  readonly entries = new Map<string, string>();
  readonly puts: Array<{ key: string; ttl: number | undefined }> = [];

  async get(key: string): Promise<string | null> {
    return this.entries.get(key) ?? null;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.puts.push({ key, ttl: options?.expirationTtl });
    this.entries.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  /** O tipo do binding, pra não repetir o cast em cada teste. */
  asNamespace(): KVNamespace {
    return this as unknown as KVNamespace;
  }
}
