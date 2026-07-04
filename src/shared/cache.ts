import type { AdminEnv } from './env';
import { shortUrl } from './link';

/**
 * Purga a URL do link no cache de edge da Cloudflare, tornando edições e
 * remoções visíveis na hora. No-op quando as credenciais não estão setadas.
 */
export async function purgeEdgeCache(env: AdminEnv, id: string): Promise<void> {
  if (!env.CF_ZONE_ID || !env.CF_API_TOKEN) return;

  await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ files: [shortUrl(env.BASE_URL, id)] }),
  });
}
