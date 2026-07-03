-include .env
export

PROJECT       := tracker
COMPOSE_NET   := $(PROJECT)_default
DB_URL_LOCAL  := postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:5433/$(POSTGRES_DB)?sslmode=disable
DB_URL_DOCKER := postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@postgres:5432/$(POSTGRES_DB)?sslmode=disable

.PHONY: help setup up down restart logs ps psql \
        migrate-up migrate-down migrate-new \
        sqlc tidy build

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n",$$1,$$2}'

setup: ## setup completo: env, sqlc, deps, up, migrations
	@test -f .env || cp .env.example .env
	$(MAKE) sqlc
	$(MAKE) tidy
	$(MAKE) up
	@echo "aguardando postgres..."
	@until docker compose exec -T postgres pg_isready -U $(POSTGRES_USER) -d $(POSTGRES_DB) >/dev/null 2>&1; do sleep 1; done
	$(MAKE) migrate-up
	@echo ""
	@echo "✓ pronto"
	@echo "  api:     http://app.localhost"
	@echo "  docs:    http://app.localhost/docs"
	@echo "  grafana: http://grafana.localhost"

up: ## sobe todo o stack
	docker compose up -d --build

down: ## derruba tudo
	docker compose down

restart: ## reinicia o tracker
	docker compose restart tracker

logs: ## segue logs
	docker compose logs -f

ps: ## lista serviços
	docker compose ps

psql: ## abre psql no container
	docker compose exec postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

migrate-up: ## aplica migrations
	docker run --rm -v $(PWD)/migrations:/migrations --network $(COMPOSE_NET) \
		migrate/migrate -path=/migrations -database "$(DB_URL_DOCKER)" up

migrate-down: ## reverte 1 migration
	docker run --rm -v $(PWD)/migrations:/migrations --network $(COMPOSE_NET) \
		migrate/migrate -path=/migrations -database "$(DB_URL_DOCKER)" down 1

migrate-new: ## cria par de migrations: make migrate-new name=add_x
	docker run --rm -v $(PWD)/migrations:/migrations \
		migrate/migrate create -ext sql -dir /migrations -seq $(name)

sqlc: ## gera código Go a partir das queries
	docker run --rm -v $(PWD):/src -w /src sqlc/sqlc generate

tidy: ## go mod tidy (via docker, não requer Go local)
	docker run --rm -v $(PWD):/app -w /app golang:1.25-alpine go mod tidy

build: ## compila binário local (fora do docker)
	go build -o ./tmp/api ./cmd/api
