FROM oven/bun:1

WORKDIR /app

EXPOSE 8080

CMD ["sh", "-c", "bun install && bun run dev"]
