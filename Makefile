# Define the default target when running just 'make'
.DEFAULT_GOAL := help

.PHONY: dev build build-ok start test test-cov test-e2e lint format clean \
	api-gateway-dev order-service-dev event-monitor-service-dev payment-service-dev \
	shipping-service-dev notification-service-dev refund-service-dev \
	frontend-install frontend-dev frontend-build frontend-lint \
	up up-all down down-v rebuild logs ps db-schemas kafka-topics kafka-groups ui help

# ----------------------------------------------------------------------------
# Local dev (run an app on the host with hot reload; needs `make up` first)
# ----------------------------------------------------------------------------
dev:
	npm run start:dev

api-gateway-dev:
	npm run start:dev -- api-gateway

order-service-dev:
	npx nest start order-service --watch

event-monitor-service-dev:
	npm run start:dev -- event-monitor

payment-service-dev:
	npm run start:dev -- payment-service

shipping-service-dev:
	npm run start:dev -- shipping-service

notification-service-dev:
	npm run start:dev -- notification-service

refund-service-dev:
	npm run start:dev -- refund-service

# ----------------------------------------------------------------------------
# Frontend (Next.js, lives in ./frontend with its OWN package.json). Dev server
# runs on http://localhost:3001 (3000 is avoided). Needs the gateway (:5000) and
# event-monitor (:4000) running for live data.
# ----------------------------------------------------------------------------
frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

frontend-lint:
	cd frontend && npm run lint

# ----------------------------------------------------------------------------
# Build / quality
# ----------------------------------------------------------------------------
build:
	npm run build

build-ok:
	npm run build && echo "BUILD OK"

start:
	npm run start:prod

test:
	npm run test

test-cov:
	npm run test:cov

test-e2e:
	npm run test:e2e

lint:
	npm run lint

format:
	npm run format

clean:
	rm -rf dist node_modules

# ----------------------------------------------------------------------------
# Docker Compose. Infra = kafka + postgres (no profile, always up).
# The 7 apps are behind the `apps` profile, so `make up` is the dev default and
# `make up-all` runs the entire system in containers.
# ----------------------------------------------------------------------------
up:
	docker compose up -d

up-all:
	docker compose --profile apps up -d --build

down:
	docker compose down

down-v:
	docker compose down -v

rebuild:
	docker compose --profile apps build

logs:
	docker compose --profile apps logs -f

ps:
	docker compose --profile apps ps

# ----------------------------------------------------------------------------
# Postgres / Kafka helpers (run against the infra containers)
# ----------------------------------------------------------------------------
db-schemas:
	docker exec -i eventtracer-postgres psql -U eventtracer -d eventtracer < initdb/01-create-schemas.sql

kafka-topics:
	docker exec eventtracer-kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list

kafka-groups:
	docker exec eventtracer-kafka /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list

ui:
	open http://localhost:3001

help:
	@echo "EventTracer — make targets"
	@echo ""
	@echo "Dev (host, hot reload — run 'make up' first):"
	@echo "  make dev                        - default app (api-gateway) in watch mode"
	@echo "  make api-gateway-dev            - API gateway (HTTP :5000) in watch mode"
	@echo "  make order-service-dev          - Order service in watch mode"
	@echo "  make event-monitor-service-dev  - Event Monitor (HTTP/WS :4000) in watch mode"
	@echo "  make payment-service-dev        - Payment service in watch mode"
	@echo "  make shipping-service-dev       - Shipping service in watch mode"
	@echo "  make notification-service-dev   - Notification service in watch mode"
	@echo "  make refund-service-dev         - Refund service in watch mode"
	@echo ""
	@echo "Frontend (Next.js, http://localhost:3001):"
	@echo "  make frontend-install           - install frontend deps"
	@echo "  make frontend-dev               - run the Next.js dev server"
	@echo "  make frontend-build             - production build of the frontend"
	@echo "  make frontend-lint              - eslint the frontend"
	@echo ""
	@echo "Build / quality:"
	@echo "  make build      - compile (default project)"
	@echo "  make build-ok   - compile and print BUILD OK"
	@echo "  make start      - run the compiled production app"
	@echo "  make test       - run unit tests (jest)"
	@echo "  make test-cov   - unit tests with coverage"
	@echo "  make test-e2e   - run e2e tests"
	@echo "  make lint       - eslint --fix"
	@echo "  make format     - prettier --write"
	@echo "  make clean      - delete dist and node_modules"
	@echo ""
	@echo "Docker Compose:"
	@echo "  make up         - start infra only (kafka + postgres) for host dev"
	@echo "  make up-all     - build + start the WHOLE system (infra + 7 apps + frontend)"
	@echo "  make down       - stop and remove containers"
	@echo "  make down-v     - down + drop volumes (resets Kafka log & DB schemas)"
	@echo "  make rebuild    - rebuild the app image"
	@echo "  make logs       - tail logs of all app + infra containers"
	@echo "  make ps         - list containers"
	@echo ""
	@echo "Helpers:"
	@echo "  make db-schemas   - create per-service schemas on an existing volume"
	@echo "  make kafka-topics - list Kafka topics"
	@echo "  make kafka-groups - list Kafka consumer groups"
	@echo "  make ui           - open the app in the browser (http://localhost:3001)"
