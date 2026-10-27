import { recordClick } from './analytics';
import type { RedirectEnv } from './env';
import { resolve } from './store';

const notFound = () => new Response('Not found', { status: 404 });

export default {
  async fetch(request, env): Promise<Response> {
    const slug = new URL(request.url).pathname.slice(1);
    if (!slug) return notFound();

    const destination = await resolve({ db: env.Db, cache: env.Cache }, slug, new Date());
    if (!destination) return notFound();

    recordClick(env.Analytics, slug, request.headers.get('cf-ipcountry'), request.headers.get('referer'));

    return new Response(null, {
      status: 302,
      headers: {
        Location: destination,
        // Sem cache: todo clique precisa chegar aqui pra contar, e uma edição
        // de destino passa a valer na hora. O KV já é a camada rápida.
        'Cache-Control': 'no-store',
      },
    });
  },
} satisfies ExportedHandler<RedirectEnv>;
