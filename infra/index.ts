/// <reference path="../.sst/platform/config.d.ts" />

import { bindAnalytics } from './analytics';
import { stage } from './stage';

/** Aplicada a todo worker. */
const COMPATIBILITY_DATE = '2025-01-01';

export function registerInfrastructure() {
  // Fonte da verdade.
  const db = new sst.cloudflare.D1('Db');

  // Cache do caminho quente. É um cache mesmo: pode ser perdido e se refaz
  // lendo do D1.
  const cache = new sst.cloudflare.Kv('Cache');

  new sst.cloudflare.Worker('Redirect', {
    handler: 'src/redirect.ts',
    link: [db, cache],
    domain: stage.redirectDomain,
    compatibility: { date: COMPATIBILITY_DATE },
    transform: { worker: bindAnalytics('Analytics', stage.clicksDataset) },
  });

  // Sem domínio: responde no endpoint .workers.dev. É API que só o dono chama,
  // e assim o domínio curto não ganha prefixo reservado nem registro de DNS.
  const api = new sst.cloudflare.Worker('Api', {
    handler: 'src/api.ts',
    link: [db, cache, secretBinding('ApiKey', new sst.Secret('ApiKey'))],
    url: true,
    compatibility: { date: COMPATIBILITY_DATE },
    environment: { BASE_URL: stage.baseUrl },
  });

  // A URL do .workers.dev é gerada, então o deploy a imprime.
  return { redirect: stage.baseUrl, api: api.url };
}

/**
 * Secret linkado como `secret_text`. Linkar o `sst.Secret` direto viraria uma
 * var `plain_text`, legível no dashboard.
 */
function secretBinding(name: string, secret: sst.Secret) {
  return new sst.Linkable(name, {
    properties: {},
    include: [
      sst.cloudflare.binding({
        type: 'secretTextBindings',
        properties: { text: secret.value },
      }),
    ],
  });
}
