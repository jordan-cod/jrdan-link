/**
 * CRUD dos links. Worker separado do redirect de propósito: um erro aqui não
 * derruba o caminho quente.
 *
 * Roteamento na mão — são cinco rotas, e um framework custaria mais do que
 * resolve.
 */

import type { ApiEnv } from './env';
import { type Link, generateSlug, normalizeUrl, shortUrl, validateExpiresIn, validateSlug } from './link';
import * as store from './store';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const fail = (message: string, status: number) => json({ error: message }, status);

const present = (link: Link, origin: string) => ({
  slug: link.slug,
  url: link.url,
  short_url: shortUrl(origin, link.slug),
  created_at: link.createdAt.toISOString(),
  expires_at: link.expiresAt?.toISOString() ?? null,
});

/** Entrada não confiável: sai daqui como objeto, ou não sai. */
async function jsonBody(request: Request): Promise<Record<string, unknown> | null> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

/** Resolve o slug do corpo: o pedido, ou um sorteado que esteja livre. */
async function resolveSlug(requested: unknown, links: store.Store): Promise<string | Response> {
  if (requested === undefined || requested === null || requested === '') {
    const allocated = await store.allocateSlug(links, generateSlug);
    return allocated ?? fail('Não consegui gerar um código livre', 500);
  }

  if (typeof requested !== 'string') return fail('Slug deve ser texto', 400);

  const error = validateSlug(requested);
  return error ? fail(error, 400) : requested;
}

async function createLink(request: Request, links: store.Store, origin: string): Promise<Response> {
  const body = await jsonBody(request);
  if (!body) return fail('Corpo da requisição deve ser um objeto JSON', 400);

  const url = normalizeUrl(body.url);
  if (!url) return fail('URL inválida (use http:// ou https://)', 400);

  // Anti-loop: encurtar o próprio encurtador cria um redirect infinito.
  if (new URL(url).origin === origin) return fail('Não dá pra encurtar um link deste site', 400);

  const expiresInError = validateExpiresIn(body.expiresIn);
  if (expiresInError) return fail(expiresInError, 400);

  const slug = await resolveSlug(body.slug, links);
  if (slug instanceof Response) return slug;

  const now = new Date();
  const created = await store.create(links, {
    slug,
    url,
    createdAt: now,
    expiresAt: typeof body.expiresIn === 'number' ? new Date(now.getTime() + body.expiresIn * 1000) : null,
  });

  if (!created) return fail('Esse slug já está em uso', 409);
  return json(present(created, origin), 201);
}

async function updateLink(request: Request, links: store.Store, slug: string, origin: string): Promise<Response> {
  const body = await jsonBody(request);
  if (!body) return fail('Corpo da requisição deve ser um objeto JSON', 400);

  const url = normalizeUrl(body.url);
  if (!url) return fail('URL inválida (use http:// ou https://)', 400);

  const updated = await store.updateUrl(links, slug, url, new Date());
  if (!updated) return fail('Link não encontrado', 404);

  return json(present(updated, origin));
}

async function route(request: Request, env: ApiEnv): Promise<Response> {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  if (segments[0] !== 'links' || segments.length > 2) return fail('Rota não encontrada', 404);

  const links: store.Store = { db: env.Db, cache: env.Cache };
  const slug = segments[1];
  const origin = env.BASE_URL;

  if (!slug) {
    if (request.method === 'POST') return createLink(request, links, origin);
    if (request.method === 'GET') {
      const all = await store.list(links);
      return json({ links: all.map((link) => present(link, origin)) });
    }
    return fail('Método não permitido', 405);
  }

  if (request.method === 'GET') {
    const link = await store.get(links, slug);
    return link ? json(present(link, origin)) : fail('Link não encontrado', 404);
  }

  if (request.method === 'PATCH') return updateLink(request, links, slug, origin);

  if (request.method === 'DELETE') {
    const removed = await store.remove(links, slug);
    return removed ? new Response(null, { status: 204 }) : fail('Link não encontrado', 404);
  }

  return fail('Método não permitido', 405);
}

export default {
  async fetch(request, env): Promise<Response> {
    const key = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!key || key !== env.ApiKey) return fail('unauthorized', 401);

    try {
      return await route(request, env);
    } catch (error) {
      console.error('Erro inesperado:', error);
      return fail('Erro interno', 500);
    }
  },
} satisfies ExportedHandler<ApiEnv>;
