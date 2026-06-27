# Define the default target when running just 'make'
.DEFAULT_GOAL := help

.PHONY: dev build build-ok start test lint order-service-dev event-monitor-service-dev payment-service-dev shipping-service-dev clean help

dev:
	npm run start:dev

order-service-dev:
	npx nest start order-service --watch

event-monitor-service-dev:
	npm run start:dev -- event-monitor

payment-service-dev:
	npm run start:dev -- payment-service

shipping-service-dev:
	npm run start:dev -- shipping-service

build:
	npm run build

build-ok:
	npm run build && echo "BUILD OK"

start:
	npm run start:prod

test:
	npm run test

lint:
	npm run lint

clean:
	rm -rf dist node_modules

help:
	@echo "Available commands:"
	@echo "  make dev    - Start NestJS application in development hot-reload mode"
	@echo "  make build  - Compile TypeScript code into JavaScript production assets"
	@echo "  make build-ok  - Compile TypeScript code into JavaScript production assets and publishes BUILD OK"
	@echo "  make start  - Run the compiled production application code"
	@echo "  make test   - Run unit test suites via Jest framework"
	@echo "  make lint   - Analyze and fix code formatting and linting errors"
	@echo "  make clean  - Delete build artifacts and local dependency modules"
	@echo "  make order-service-dev  - Starts orderService and watch for changes"
	@echo "  event-monitor-service-dev  - Starts Event Monitor service and watch for changes"
	@echo "  payment-service-dev  - Starts Payment service and watch for changes"
	@echo "  shipping-service-dev  - Starts Shipping service and watch for changes"
