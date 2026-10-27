import { beforeEach, describe, expect, it } from 'bun:test';

import api from './api';
import type { ApiEnv } from './env';
import { FakeKv, fakeD1 } from './fakes';

/** O worker recebe o Request da Cloudflare, mais largo que o do padrão. */
type WorkerRequest = Parameters<typeof api.fetch>[0];

const KEY = 'chave-secreta';
const BASE_URL = 'https://jrdan.link';
const API = 'https://api.workers.dev';

let cache: FakeKv;
let env: ApiEnv;

beforeEach(() => {
  cache = new FakeKv();
  env = { Db: fakeD1(), Cache: cache.asNamespace(), ApiKey: KEY, BASE_URL };
});

function call(method: string, path: string, body?: unknown, key: string | null = KEY): Promise<Response> {
  const headers: Record<string, string> = {};
  if (key !== null) headers.authorization = `Bearer ${key}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  const request = new Request(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return api.fetch(request as WorkerRequest, env) as Promise<Response>;
}

const create = (body: unknown) => call('POST', '/links', body);

describe('autenticação', () => {
  it('recusa sem header', async () => {
    expect((await call('GET', '/links', undefined, null)).status).toBe(401);
  });

  it('recusa com chave errada', async () => {
    expect((await call('GET', '/links', undefined, 'errada')).status).toBe(401);
  });
});

describe('roteamento', () => {
  it('404 fora de /links', async () => {
    expect((await call('GET', '/outra')).status).toBe(404);
    expect((await call('GET', '/links/git/stats')).status).toBe(404);
  });

  it('405 em método sem rota', async () => {
    expect((await call('PUT', '/links')).status).toBe(405);
    expect((await call('POST', '/links/git')).status).toBe(405);
  });
});

describe('POST /links', () => {
  it('cria com slug sorteado e devolve o short_url', async () => {
    const response = await create({ url: 'https://github.com' });
    const body = (await response.json()) as Record<string, string>;

    expect(response.status).toBe(201);
    expect(body.url).toBe('https://github.com/');
    expect(body.short_url).toBe(`${BASE_URL}/${body.slug}`);
    expect(cache.entries.get(body.slug as string)).toBe('https://github.com/');
  });

  it('usa o slug pedido', async () => {
    const body = (await (await create({ url: 'https://github.com', slug: 'git' })).json()) as { slug: string };

    expect(body.slug).toBe('git');
  });

  it('recusa slug repetido com 409', async () => {
    await create({ url: 'https://github.com', slug: 'git' });

    expect((await create({ url: 'https://gitlab.com', slug: 'git' })).status).toBe(409);
  });

  it('recusa URL inválida, slug torto e expiresIn torto', async () => {
    expect((await create({ url: 'ftp://arquivo' })).status).toBe(400);
    expect((await create({ url: 'https://github.com', slug: 'a b' })).status).toBe(400);
    expect((await create({ url: 'https://github.com', expiresIn: -1 })).status).toBe(400);
    expect((await create({ url: 'https://github.com', slug: 42 })).status).toBe(400);
  });

  it('recusa encurtar um link do próprio encurtador', async () => {
    expect((await create({ url: `${BASE_URL}/git` })).status).toBe(400);
  });

  it('recusa corpo que não é objeto JSON', async () => {
    const request = new Request(`${API}/links`, {
      method: 'POST',
      headers: { authorization: `Bearer ${KEY}` },
      body: 'nao-e-json',
    });

    expect(((await api.fetch(request as WorkerRequest, env)) as Response).status).toBe(400);
  });

  it('grava o expiresIn como TTL no cache', async () => {
    await create({ url: 'https://github.com', slug: 'git', expiresIn: 3600 });

    expect(cache.puts).toEqual([{ key: 'git', ttl: 3600 }]);
  });
});

describe('GET /links', () => {
  it('lista o que existe', async () => {
    await create({ url: 'https://github.com', slug: 'git' });

    const body = (await (await call('GET', '/links')).json()) as { links: Array<{ slug: string }> };

    expect(body.links.map((link) => link.slug)).toEqual(['git']);
  });

  it('lista vazia sem links', async () => {
    const body = (await (await call('GET', '/links')).json()) as { links: unknown[] };

    expect(body.links).toEqual([]);
  });
});

describe('GET /links/:slug', () => {
  it('devolve o link', async () => {
    await create({ url: 'https://github.com', slug: 'git' });

    const body = (await (await call('GET', '/links/git')).json()) as { url: string };

    expect(body.url).toBe('https://github.com/');
  });

  it('404 para slug desconhecido', async () => {
    expect((await call('GET', '/links/sumiu')).status).toBe(404);
  });
});

describe('PATCH /links/:slug', () => {
  it('troca o destino e acerta o cache junto', async () => {
    await create({ url: 'https://github.com', slug: 'git' });

    const response = await call('PATCH', '/links/git', { url: 'https://gitlab.com' });

    expect(response.status).toBe(200);
    expect(cache.entries.get('git')).toBe('https://gitlab.com/');
  });

  it('recusa URL inválida', async () => {
    await create({ url: 'https://github.com', slug: 'git' });

    expect((await call('PATCH', '/links/git', { url: 'ftp://x' })).status).toBe(400);
    expect(cache.entries.get('git')).toBe('https://github.com/');
  });

  it('404 para slug desconhecido', async () => {
    expect((await call('PATCH', '/links/sumiu', { url: 'https://gitlab.com' })).status).toBe(404);
  });
});

describe('DELETE /links/:slug', () => {
  it('apaga do banco e do cache', async () => {
    await create({ url: 'https://github.com', slug: 'git' });

    expect((await call('DELETE', '/links/git')).status).toBe(204);
    expect((await call('GET', '/links/git')).status).toBe(404);
    expect(cache.entries.has('git')).toBe(false);
  });

  it('404 para slug desconhecido', async () => {
    expect((await call('DELETE', '/links/sumiu')).status).toBe(404);
  });
});
