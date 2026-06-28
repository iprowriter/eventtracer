# EventTracer frontend (Next.js). Built separately from the NestJS apps — its own
# context, deps, and lockfile. Produces a lean standalone server image.

# ---- builder: install deps and build the standalone server ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
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
