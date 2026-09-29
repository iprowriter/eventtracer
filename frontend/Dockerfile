# EventTracer frontend (Next.js). Built separately from the NestJS apps — its own
# context, deps, and lockfile. Produces a lean standalone server image.

# ---- builder: install deps and build the standalone server ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# The browser-facing URLs are inlined into the client bundle at build time
# (Next.js NEXT_PUBLIC_*). Passed as build args — default to localhost so local
# builds are unchanged; the deploy overrides them (via compose .env) with the
# public https origin. .env* is dockerignored, so these args are the only source.
ARG NEXT_PUBLIC_GATEWAY_URL=http://localhost:5050
ARG NEXT_PUBLIC_MONITOR_URL=http://localhost:4000
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL
ENV NEXT_PUBLIC_MONITOR_URL=$NEXT_PUBLIC_MONITOR_URL

# next.config.ts sets output:"standalone" → .next/standalone holds server.js + deps.
RUN npm run build

# ---- runtime: copy only what the standalone server needs ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3001
CMD ["node", "server.js"]
