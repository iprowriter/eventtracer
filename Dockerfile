# Multi-stage build shared by every EventTracer NestJS app.
#
# One image holds all seven app bundles at dist/apps/<app>/main.js; each compose
# service runs a different one by overriding `command:`. (See docker-compose.yml.)

# ---- builder: install everything (incl. the Nest CLI) and compile all apps ----
FROM node:22-alpine AS builder
WORKDIR /app

# Install deps first so this layer caches until package*.json changes.
COPY package*.json ./
RUN npm ci

COPY . .

# Build each app. nest-cli's deleteOutDir only cleans that app's own dist subdir,
# so the bundles accumulate side by side under dist/apps/.
RUN for app in \
      api-gateway \
      order-service \
      payment-service \
      shipping-service \
      notification-service \
      refund-service \
      event-monitor; do \
        echo ">> building $app" && npx nest build "$app"; \
    done

# ---- runtime: production deps + the compiled bundles only ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Default; every compose service overrides this with its own app bundle.
CMD ["node", "dist/apps/api-gateway/main"]
