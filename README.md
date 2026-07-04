# jrdan.link

Encurtador de URLs pessoal na Cloudflare Workers. Redirect no edge (cache + KV),
admin protegido por API key. Custo: **$0** no free tier.

## Arquitetura

```
jrdan.link/{id}      → Worker "redirect"  → Cache API (edge) → KV
app.jrdan.link       → Worker "admin"     → CRUD (API key) → KV + purge
                                            armazenamento: KV namespace "links"
```

- **redirect** (`src/redirect.ts`): lê o cache do edge; no miss, lê o KV e cacheia o 302.
- **admin** (`src/admin.ts`): CRUD em Hono, exige `Authorization: Bearer`, purga o cache no edit/delete.

## Estrutura

```
src/
├── redirect.ts        # Worker do redirect (jrdan.link)
├── admin.ts           # Worker do CRUD (app.jrdan.link)
└── shared/
    ├── short-id.ts    # gerador de id
    └── link.ts        # metadata + shortUrl
wrangler.redirect.jsonc
wrangler.admin.jsonc
```

## Dev local

```bash
bun install
bun run dev:redirect     # miniflare simula o KV
bun run dev:admin
bun run typecheck
```

Semear um link no KV local:

```bash
bunx wrangler kv key put <id> "https://destino.com" --binding LINKS --local --config wrangler.redirect.jsonc
```

## Deploy

```bash
bun run deploy:redirect   # jrdan.link
bun run deploy:admin      # app.jrdan.link
```

### Secrets (setados uma vez, ficam na Cloudflare)

```bash
bunx wrangler secret put ADMIN_API_KEY --config wrangler.admin.jsonc   # chave do CRUD
bunx wrangler secret put CF_API_TOKEN  --config wrangler.admin.jsonc   # token c/ permissão Cache Purge
```

`CF_ZONE_ID` já está em `wrangler.admin.jsonc` (var). Sem `CF_API_TOKEN` o cache
ainda funciona, só invalida por TTL em vez de na hora.

## Uso

```bash
KEY=<ADMIN_API_KEY>

# criar (slug opcional 3-32 chars; expiresIn opcional em segundos)
curl -X POST https://app.jrdan.link/links \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"url":"https://github.com","slug":"gh"}'

# listar
curl https://app.jrdan.link/links -H "Authorization: Bearer $KEY"

# editar destino
curl -X PATCH https://app.jrdan.link/links/gh \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"url":"https://novo.com"}'

# apagar
curl -X DELETE https://app.jrdan.link/links/gh -H "Authorization: Bearer $KEY"

# usar o link curto
curl -I https://jrdan.link/gh
```

## Notas operacionais

- **Cache**: edge 30 dias (`s-maxage`), navegador 60s (`max-age`). Edit/delete purgam o edge na hora.
- **KV é eventualmente consistente**: `list` demora ~30-60s pra refletir escritas novas; o redirect (`get`) vê na hora.
- **Browser Cache TTL da zona** pode sobrescrever o `max-age`; pra honrar o header, `Caching → Configuration → Respect Existing Headers`.
