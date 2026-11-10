# Multi-stage Dockerfile for DON API (Cloud Run Ready)
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root workspace manifests and lockfile
COPY package.json pnpm-workspace.yaml* pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/ai/package.json ./packages/ai/
COPY packages/ui/package.json ./packages/ui/
COPY packages/config/package.json ./packages/config/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/desktop-agent/package.json ./apps/desktop-agent/
COPY apps/browser-extension/package.json ./apps/browser-extension/

# Install all dependencies across the workspace
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source trees
COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY packages/ai ./packages/ai
COPY apps/api ./apps/api

# Build shared packages and API
RUN pnpm --filter @don/shared run build
RUN pnpm --filter @don/ai run build
RUN pnpm --filter @don/api run build

# Production Runner Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Security hardening: Run as non-root node user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/package.json ./package.json

USER nodejs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
