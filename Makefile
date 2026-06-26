# Define the default target when running just 'make'
.DEFAULT_GOAL := help

.PHONY: dev build start test lint clean help

dev:
	npm run start:dev

order-service-dev:
    npx nest start order-service --watch

build:
	npm run build

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
	@echo "  make start  - Run the compiled production application code"
	@echo "  make test   - Run unit test suites via Jest framework"
	@echo "  make lint   - Analyze and fix code formatting and linting errors"
	@echo "  make clean  - Delete build artifacts and local dependency modules"
	@echo "  make order-service-dev  - Starts orderService and watch for changes"
