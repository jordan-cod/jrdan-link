# jrdan.link

Encurtador de URLs pessoal. O redirect roda na edge da Cloudflare; o painel e a API rodam na VPS.

```
jrdan.link/{slug}        Worker redirect ─▶ cache da edge ─▶ KV ─▶ 302
shortener.jrdan.dev      Painel + API (Bun) ─▶ SQLite (fonte da verdade)
                                     └──▶ KV + purge do cache, a cada mudança
```

O redirect não depende da VPS: se ela cair, os links continuam funcionando. A API grava no SQLite e
publica no KV na mesma operação; se a Cloudflare recusar, a mudança é desfeita e o painel avisa.

## Estrutura

| Pasta | O quê |
|---|---|
| `redirect/` | Worker do `jrdan.link`. Lê o KV, cacheia na edge respeitando a expiração do link. |
| `server/` | API e servidor do painel. Elysia, `bun:sqlite`, login com GitHub, tokens pessoais. |
| `web/` | Painel. React, Vite, TanStack Router e Query, Tailwind. |
| `tools/shorten.sh` | Atalho do Mac: encurta a URL do clipboard e copia o link curto. |

## Desenvolvimento

```bash
bun install
cp .env.example server/.env   # preencha; PUBLIC_URL=http://localhost:5173 pro dev
bun run dev                    # API em :3000, painel em :5173 com proxy pra API
```

```bash
bun run check       # biome
bun run typecheck
bun run test
```

## Login

Só a conta em `GITHUB_ALLOWED_LOGIN` entra. Crie um OAuth App em
<https://github.com/settings/developers> com callback `https://shortener.jrdan.dev/auth/github/callback`.

Scripts usam tokens criados em **Tokens**, no header `Authorization: Bearer jl_...`. Tokens não
conseguem criar nem revogar outros tokens.

## Cloudflare

A API precisa de um token com **Workers KV Storage: Edit** na conta e **Cache Purge** na zona
`jrdan.link`. Account, namespace e zone ids vão no `.env`.

## Deploy

O workflow `Deploy` roda checks em todo PR. No `main`, ele publica o worker do redirect e uma imagem
em `ghcr.io/jordan-cod/jrdan-link/app`, e sobe o container na VPS quando `DEPLOY_ENABLED=true`.

Na VPS, a pasta do projeto (`DEPLOY_PATH`) tem o `docker-compose.prod.yml` como `docker-compose.yml`
e o `.env` de produção. O Caddy compartilhado aponta o domínio pro container:

```caddyfile
shortener.jrdan.dev {
	encode zstd gzip
	reverse_proxy shortener:3000
}
```

Secrets do repositório: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DEPLOY_HOST`, `DEPLOY_USER`,
`DEPLOY_SSH_KEY`, `DEPLOY_PATH`. Variáveis: `DEPLOY_ENABLED`, `PANEL_HOST`.

### Primeira subida

Os links que já estavam no KV entram no SQLite com:

```bash
docker compose exec app bun run import:kv
```

## Atalho do Mac

Gere um token no painel e guarde no Keychain:

```bash
security add-generic-password -a jrdan -s jrdan-link-token -w 'jl_...' -U
```

No Shortcuts.app, crie um atalho com **Run Shell Script** apontando pra `tools/shorten.sh` e
atribua um atalho de teclado. Ele lê a URL do argumento, do input do atalho ou do clipboard.
