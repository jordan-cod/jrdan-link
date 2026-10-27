import { beforeEach, describe, expect, it } from 'bun:test';

import { FakeKv, fakeD1 } from './fakes';
import type { Link } from './link';
import * as store from './store';

const NOW = new Date('2026-06-01T00:00:00.000Z');

let cache: FakeKv;
let links: store.Store;

beforeEach(() => {
  cache = new FakeKv();
  links = { db: fakeD1(), cache: cache.asNamespace() };
});

const link = (overrides: Partial<Link> = {}): Link => ({
  slug: 'git',
  url: 'https://github.com/',
  createdAt: NOW,
  expiresAt: null,
  ...overrides,
});

describe('create', () => {
  it('grava no D1 e no cache', async () => {
    expect(await store.create(links, link())).not.toBeNull();

    expect(await store.get(links, 'git')).toMatchObject({ slug: 'git', url: 'https://github.com/' });
    expect(cache.entries.get('git')).toBe('https://github.com/');
  });

  it('recusa um slug já usado sem sobrescrever', async () => {
    await store.create(links, link());

    expect(await store.create(links, link({ url: 'https://gitlab.com/' }))).toBeNull();
    expect((await store.get(links, 'git'))?.url).toBe('https://github.com/');
  });

  it('dá ao cache o TTL do link, e nenhum quando ele não expira', async () => {
    await store.create(links, link({ expiresAt: new Date(NOW.getTime() + 3600_000) }));
    await store.create(links, link({ slug: 'perene' }));

    expect(cache.puts).toEqual([
      { key: 'git', ttl: 3600 },
      { key: 'perene', ttl: undefined },
    ]);
  });

  it('não cacheia link que expira em menos de um minuto', async () => {
    // O KV recusa expirationTtl abaixo de 60s.
    await store.create(links, link({ expiresAt: new Date(NOW.getTime() + 30_000) }));

    expect(cache.puts).toEqual([{ key: 'git', ttl: undefined }]);
  });
});

describe('resolve', () => {
  it('responde do cache', async () => {
    await cache.put('git', 'https://do-cache.com/');

    expect(await store.resolve(links, 'git', NOW)).toBe('https://do-cache.com/');
  });

  it('cai no D1 no miss e repõe o cache', async () => {
    await store.create(links, link());
    cache.entries.clear();

    expect(await store.resolve(links, 'git', NOW)).toBe('https://github.com/');
    expect(cache.entries.get('git')).toBe('https://github.com/');
  });

  it('devolve null para slug desconhecido', async () => {
    expect(await store.resolve(links, 'sumiu', NOW)).toBeNull();
  });

  it('não serve nem recacheia link expirado', async () => {
    await store.create(links, link({ expiresAt: new Date(NOW.getTime() + 3600_000) }));
    cache.entries.clear();

    const depois = new Date(NOW.getTime() + 7200_000);

    expect(await store.resolve(links, 'git', depois)).toBeNull();
    expect(cache.entries.has('git')).toBe(false);
  });
});

describe('updateUrl', () => {
  it('troca o destino e reescreve o cache na hora', async () => {
    await store.create(links, link());

    const updated = await store.updateUrl(links, 'git', 'https://gitlab.com/', NOW);

    expect(updated?.url).toBe('https://gitlab.com/');
    expect(cache.entries.get('git')).toBe('https://gitlab.com/');
  });

  it('preserva o createdAt', async () => {
    await store.create(links, link());

    const updated = await store.updateUrl(links, 'git', 'https://gitlab.com/', new Date('2027-01-01T00:00:00.000Z'));

    expect(updated?.createdAt).toEqual(NOW);
  });

  it('devolve null para slug desconhecido', async () => {
    expect(await store.updateUrl(links, 'sumiu', 'https://gitlab.com/', NOW)).toBeNull();
  });
});

describe('remove', () => {
  it('apaga do D1 e do cache', async () => {
    await store.create(links, link());

    expect(await store.remove(links, 'git')).toBe(true);
    expect(await store.get(links, 'git')).toBeNull();
    expect(cache.entries.has('git')).toBe(false);
  });

  it('devolve false para slug desconhecido', async () => {
    expect(await store.remove(links, 'sumiu')).toBe(false);
  });
});

describe('list', () => {
  it('devolve do mais novo pro mais velho', async () => {
    await store.create(links, link({ slug: 'velho', createdAt: new Date('2026-01-01T00:00:00.000Z') }));
    await store.create(links, link({ slug: 'novo', createdAt: new Date('2026-05-01T00:00:00.000Z') }));

    expect((await store.list(links)).map((l) => l.slug)).toEqual(['novo', 'velho']);
  });

  it('devolve lista vazia sem links', async () => {
    expect(await store.list(links)).toEqual([]);
  });
});

describe('allocateSlug', () => {
  it('pula os slugs já usados', async () => {
    await store.create(links, link({ slug: 'aaaaa' }));
    const sequence = ['aaaaa', 'bbbbb'];

    expect(await store.allocateSlug(links, () => sequence.shift() as string)).toBe('bbbbb');
  });

  it('desiste depois das tentativas', async () => {
    await store.create(links, link({ slug: 'aaaaa' }));

    expect(await store.allocateSlug(links, () => 'aaaaa', 3)).toBeNull();
  });
});
