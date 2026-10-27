FROM oven/bun:1.3.13-alpine AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY redirect/package.json redirect/
COPY server/package.json server/
COPY web/package.json web/
RUN bun install --frozen-lockfile
COPY web web
RUN cd web && bunx vite build

FROM oven/bun:1.3.13-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY redirect/package.json redirect/
COPY server/package.json server/
COPY web/package.json web/
RUN bun install --frozen-lockfile --production --filter '@jrdan-link/server'

FROM oven/bun:1.3.13-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/jrdan-link.db WEB_DIST=/app/web
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/server/node_modules server/node_modules
COPY server/package.json server/
COPY server/src server/src
COPY server/scripts server/scripts
COPY --from=build /app/web/dist web
RUN mkdir -p /data && chown bun:bun /data
USER bun
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
WORKDIR /app/server
CMD ["bun", "src/index.ts"]
