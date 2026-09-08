# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.14.0
ARG PNPM_VERSION=9.15.9

# --------------------------------------------------
# Base
# --------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base

ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN corepack enable \
    && corepack prepare "pnpm@${PNPM_VERSION}" --activate \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --------------------------------------------------
# Dependencies
# Railway cache mounts require a service-specific id. Keeping the Dockerfile
# repository-portable is preferable to hardcoding a Railway service id here.
# --------------------------------------------------
FROM base AS dependencies

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# --------------------------------------------------
# Builder
# --------------------------------------------------
FROM base AS builder

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build-only placeholders. Real runtime values are injected by Railway.
ENV APP_ENV=development
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV DIRECT_URL=postgresql://build:build@127.0.0.1:5432/build
ENV APP_URL=http://localhost:3000
ENV JWT_SECRET=build-only-secret-not-used-at-runtime-000000000000
ENV STORAGE_DRIVER=local
ENV COOKIE_SECURE=false

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN pnpm prisma generate \
    && pnpm build

# --------------------------------------------------
# Runtime
# Uses Debian Chromium so the browser path is deterministic on Railway.
# Prisma CLI dependencies are retained because Railway runs migrations during
# pre-deploy and again as an idempotent startup fallback before Next.js.
# --------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime

ARG PNPM_VERSION

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

RUN corepack enable \
    && corepack prepare "pnpm@${PNPM_VERSION}" --activate \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       openssl \
       dumb-init \
       chromium \
    && chromium --version \
    && rm -rf /var/lib/apt/lists/*

# Full node_modules is intentionally retained for Prisma CLI during Railway
# migration execution. Next.js itself still runs from standalone output.
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/dist/worker ./dist/worker
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/railway-predeploy.sh ./railway-predeploy.sh
COPY --from=builder --chown=node:node /app/railway-start.sh ./railway-start.sh

USER node

# Railway injects PORT dynamically. The startup script first applies pending
# Prisma migrations, then execs the standalone Next.js server.
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "railway-start.sh"]
