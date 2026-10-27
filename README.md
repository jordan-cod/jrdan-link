# jrdan-link

Encurtador de URLs na Cloudflare, com SST. Custo ~$0 no free tier.

Nada de domínio ou id de conta no código: forkar, preencher o `.env` e dar
deploy. Precisa só de um domínio numa zona da Cloudflare.

> **Estado:** redirect e API de CRUD no ar. Os cliques são gravados, mas ainda
> não há como lê-los — falta o endpoint de stats.

## Arquitetura

O desenho segue o que os encurtadores grandes fazem, com as primitivas da
Cloudflare no lugar das deles:

| Bitly / Dub                         | aqui                 |
| ----------------------------------- | -------------------- |
| MySQL / Postgres (fonte da verdade) | **D1**               |
| Redis (cache do caminho quente)     | **KV**               |
| Kafka → ClickHouse / Tinybird       | **Analytics Engine** |

```
{DOMAIN}/{slug}    → Redirect → KV (hit) ──────────────→ 302
                              → KV (miss) → D1 → repõe → 302
                              └→ writeDataPoint (o clique)

<gerado>.workers.dev → Api    → D1 (CRUD) + KV (write-through)
```

A API fica num worker separado do redirect: um erro nela não derruba o caminho
quente. E fica sem domínio custom, no endpoint `.workers.dev` — é API que só o
dono chama, então não vale gastar um subdomínio nem reservar prefixo no domínio
curto.

Três decisões que valem explicação:

**D1 é a fonte da verdade, KV é cache.** Toda escrita passa pelo D1 e acerta o
KV junto, então editar um destino vale na hora. O redirect lê do KV e, no miss,
volta ao D1 e repõe — o KV pode ser perdido inteiro sem perder dado.

**Clique é evento, não contador.** Nada incrementa nada: cada clique vira um
ponto no Analytics Engine, e o total seria um `SUM` na hora da consulta. Não
existe escrita concorrente pra se perder, que é o problema clássico de contador
em KV. A escrita é não-bloqueante e não custa latência ao redirect.

**Não tem cache de borda no redirect.** Poderia ter, mas aí o clique só contaria
no cache miss — e editar um link exigiria purgar o edge. Como o KV já é rápido,
a camada extra custaria um token de purge e um `zoneId` pra ganhar poucos
milissegundos. O 302 sai com `no-store`.

## Estrutura

```
sst.config.ts       # entrada do SST
infra/
├── index.ts        # os recursos e o worker
├── stage.ts        # domínio derivado do .env
└── analytics.ts    # o binding de Analytics Engine (ver abaixo)
migrations/
└── 0001_init.sql   # schema do D1
src/
├── link.ts         # regras: url, slug, expiração, geração de código
├── store.ts        # D1 + KV
├── analytics.ts    # recordClick
├── env.ts          # os bindings, escritos à mão
├── redirect.ts     # worker do redirect
├── api.ts          # worker do CRUD (roteamento na mão)
└── fakes.ts        # D1 e KV falsos, só pros testes
```

Zero dependência de runtime — só o SST e as ferramentas de build. O roteamento
da API é escrito à mão: são cinco rotas, e um framework custaria mais do que
resolve.

### O único hack

`sst.cloudflare.binding()` cobre 13 tipos de binding e Analytics Engine não é um
deles. Então `infra/analytics.ts` acrescenta o binding direto no recurso do
Pulumi, via `transform`. Fica isolado nesse arquivo; se o SST passar a suportar
o tipo, é ele que morre.

O dataset em si não é criado por IaC — a Cloudflare o cria na primeira escrita,
então tudo que existe do lado da infra é o nome.

## Stages

| stage          | domínio            |
| -------------- | ------------------ |
| `production`   | `{DOMAIN}`         |
| qualquer outro | `{stage}.{DOMAIN}` |

Cada stage tem o seu D1, o seu KV e o seu dataset de cliques.

## Setup

```bash
bun install
cp .env.example .env      # preencha o DOMAIN

export CLOUDFLARE_API_TOKEN=...          # Workers, KV, D1, DNS e R2 (state)
export CLOUDFLARE_DEFAULT_ACCOUNT_ID=...

bunx sst secret set ApiKey <chave-forte> --stage production
```

A `ApiKey` vira um binding `secret_text` (encriptado), não uma var em texto puro
visível no dashboard.

Aplique a migração no D1 depois do primeiro deploy:

```bash
bunx wrangler d1 execute <nome-do-banco> --remote --file migrations/0001_init.sql
```

## Deploy

```bash
bun run deploy   # sst deploy --stage production
bun run dev      # sst dev (stage pessoal)
```

## Uso

O `sst deploy` imprime a URL da API, que é gerada:

```bash
KEY=<ApiKey>
API=https://<gerado>.workers.dev

# criar (slug e expiresIn em segundos são opcionais)
curl -X POST $API/links \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"url":"https://github.com","slug":"git"}'

curl $API/links     -H "Authorization: Bearer $KEY"   # listar
curl $API/links/git -H "Authorization: Bearer $KEY"   # ver um

curl -X PATCH $API/links/git -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"url":"https://gitlab.com"}'

curl -X DELETE $API/links/git -H "Authorization: Bearer $KEY"

curl -I https://seu-dominio.link/git   # usar o link
```

Editar e apagar já limpam o KV junto — era esse o passo manual e fácil de
esquecer que a API veio resolver.

## Notas operacionais

- **302, não 301.** O 301 o navegador cacheia pra sempre: você perderia a
  contagem e não conseguiria mais editar o destino. Todo encurtador comercial
  usa 302 pelo mesmo motivo.
- **Os cliques estão sendo gravados desde já**, mesmo sem ninguém lê-los ainda —
  quando o fluxo de stats existir, já vai ter histórico. A consulta é um POST
  em `/accounts/{id}/analytics_engine/sql`, com um token de permissão
  **Account | Account Analytics | Read**.
- **Free tier do Analytics Engine**: 100 mil pontos e 10 mil queries por dia.
- **Free tier do D1**: 100 mil escritas/dia. Só link passa por lá — clique não
  toca o D1.
- **`GET /links` faz um `SELECT` sem paginação.** Serve pra centenas de links;
  se um dia forem milhares, é aí que dói.
- **Link expirado** some do KV pelo TTL e é filtrado na leitura do D1, mas a
  linha continua lá.
- **Produção é `protect` + `removal: retain`**: um `sst remove` não leva o D1
  junto.

## Scripts

```bash
bun test           # regras, store e API, com D1 fake em cima do bun:sqlite
bun run typecheck  # app + infra (dois programas: o platform do SST não
                   # compila com noUncheckedIndexedAccess)
bun run check      # biome: lint + format
```
