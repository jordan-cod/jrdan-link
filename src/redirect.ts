import { isbot } from 'isbot';

import type { RedirectEnv } from './shared/env';

const BROWSER_TTL_SECONDS = 60;
const EDGE_TTL_SECONDS = 2_592_000;

function recordClick(env: RedirectEnv, ctx: ExecutionContext, id: string, request: Request): void {
  const cf = request.cf;
  const userAgent = request.headers.get('user-agent');

  ctx.waitUntil(
    env.DB.prepare(
      'INSERT INTO clicks (link_id, country, city, region, referer, user_agent, is_bot) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        id,
        cf?.country ?? null,
        cf?.city ?? null,
        cf?.region ?? null,
        request.headers.get('referer'),
        userAgent,
        isbot(userAgent) ? 1 : 0,
      )
      .run(),
  );
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const id = url.pathname.slice(1);
    if (!id) return new Response('Not found', { status: 404 });

    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/${id}`);

    const cached = await cache.match(cacheKey);
    if (cached) {
      recordClick(env, ctx, id, request);
      return cached;
    }

    const destination = await env.LINKS.get(id, 'text');
    if (!destination) return new Response('Not found', { status: 404 });

    recordClick(env, ctx, id, request);

    const response = new Response(null, {
      status: 302,
      headers: {
        Location: destination,
        'Cache-Control': `public, max-age=${BROWSER_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}`,
      },
    });

    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
} satisfies ExportedHandler<RedirectEnv>;
