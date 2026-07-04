# jrdan.link

Encurtador de URLs pessoal na **Cloudflare Workers**. Redirect no edge (cache + KV),
admin protegido por API key, e analytics de clique (geo, bot, data) em D1.
Roda no **free tier** — custo ~$0.

## Arquitetura

```
jrdan.link/{id}    → Worker redirect  → Cache API (edge) → KV        → 302
                                      ↘ grava clique (waitUntil)  → D1
app.jrdan.link     → Worker admin     → CRUD + analytics (API key) → KV + D1
```

- **redirect** (`src/redirect.ts`): serve o 302 do cache do edge; no miss lê o KV e cacheia.
  Registra cada clique no D1 de forma assíncrona (não bloqueia o redirect).
- **admin** (`src/admin.ts`): CRUD dos links + endpoints de analytics. Exige `Authorization: Bearer`.
  Purga o cache no edit/delete.

Storage:

- **KV** (`LINKS`): `id → url` (valor) + metadata `{ url, createdAt }`. Fonte do redirect.
- **D1** (`clicks`): uma linha por clique com geo (`request.cf`), referer, user agent e flag de bot.

## Estrutura

```
src/
├── redirect.ts          # Worker do redirect (jrdan.link)
├── admin.ts             # Worker do admin (app.jrdan.link) — compõe as rotas
├── admin/
│   ├── links.ts         # rotas de CRUD dos links
│   └── analytics.ts     # rotas de stats / clicks
└── shared/
    ├── env.ts           # tipos dos bindings
    ├── link.ts          # LinkMetadata + shortUrl
    ├── schemas.ts       # validação (zod)
    ├── cache.ts         # purge do cache de edge
    └── short-id.ts      # gerador de id
schema.sql               # tabela de clicks (D1)
```

## Setup

```bash
bun install
bunx wrangler login

# KV + D1 (copie os ids gerados pros wrangler.*.jsonc)
bunx wrangler kv namespace create LINKS
bunx wrangler d1 create jrdan-link-clicks
bunx wrangler d1 execute jrdan-link-clicks --file schema.sql --remote

# secrets do admin
bunx wrangler secret put ADMIN_API_KEY --config wrangler.admin.jsonc
bunx wrangler secret put CF_API_TOKEN  --config wrangler.admin.jsonc  # permissão Cache Purge
```

`BASE_URL` e `CF_ZONE_ID` ficam em `vars` no `wrangler.admin.jsonc`. Pra `wrangler dev` local,
copie `.dev.vars.example` → `.dev.vars`.

## Deploy

```bash
bun run deploy:redirect   # jrdan.link
bun run deploy:admin      # app.jrdan.link
```

## Uso

```bash
KEY=<ADMIN_API_KEY>

# criar (slug 3-32 chars e expiresIn em segundos são opcionais)
curl -X POST https://app.jrdan.link/links \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"url":"https://github.com","slug":"gh"}'

curl https://app.jrdan.link/links            -H "Authorization: Bearer $KEY"   # listar
curl -X PATCH  https://app.jrdan.link/links/gh -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"url":"https://novo.com"}'          # editar
curl -X DELETE https://app.jrdan.link/links/gh -H "Authorization: Bearer $KEY" # apagar

# analytics (filtro de data opcional: ?from=YYYY-MM-DD&to=YYYY-MM-DD)
curl "https://app.jrdan.link/links/gh/stats"  -H "Authorization: Bearer $KEY"  # total, humans, bots, por país, por dia
curl "https://app.jrdan.link/links/gh/clicks" -H "Authorization: Bearer $KEY"  # rows individuais

curl -I https://jrdan.link/gh   # usar o link
```

## Notas operacionais

- **Cache**: edge 30 dias (`s-maxage`), navegador 60s (`max-age`); edit/delete purgam o edge na hora.
- **KV é eventualmente consistente**: `GET /links` (list) demora ~30-60s pra refletir escritas; o redirect (`get`) vê na hora.
- **Geo/bot**: geo vem do `request.cf` (grátis, sem API externa); bot é detectado por User-Agent (`isbot`). Stats contam humanos por padrão.

## Scripts

```bash
bun run typecheck
bun run check      # biome: lint + format
```

## Licença

MIT — veja [LICENSE](./LICENSE).
