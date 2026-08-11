# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.14.0
ARG PNPM_VERSION=9.15.9

FROM node:${NODE_VERSION}-bookworm-slim@sha256:1c18d9ab3af4585870b92e4dbc5cac5a0dc77dd13df1a5905cea89fc720eb05b AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable && corepack prepare "pnpm@${PNPM_VERSION}" --activate
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV APP_ENV=development
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV APP_URL=http://localhost:3000
ENV JWT_SECRET=build-only-secret-not-used-at-runtime-000000000000
ENV STORAGE_DRIVER=local
ENV COOKIE_SECURE=false
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate && pnpm build

FROM base AS migration
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
CMD ["pnpm", "prisma", "migrate", "deploy"]

FROM ghcr.io/puppeteer/puppeteer:25.3.0@sha256:9665f5b57abc5cc7080a641878964018de219055a4d2c9d8d050ceb1161778ba AS runtime
USER root
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PUPPETEER_EXECUTABLE_PATH=/opt/chrome/chrome
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_PATH=/home/pptruser/node_modules
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends dumb-init \
    && cp -a /home/pptruser/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64 /opt/chrome \
    && /opt/chrome/chrome --version \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=10042:10042 /app/.next/standalone ./
COPY --from=builder --chown=10042:10042 /app/.next/static ./.next/static
COPY --from=builder --chown=10042:10042 /app/public ./public
COPY --from=builder --chown=10042:10042 /app/dist/worker ./dist/worker
COPY --from=builder --chown=10042:10042 /app/prisma ./prisma

USER 10042
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
