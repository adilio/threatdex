FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# ---- dependencies stage ----
FROM base AS deps
WORKDIR /app

# Copy workspace manifest files first for layer caching
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/schema/package.json ./packages/schema/
COPY packages/ui/package.json ./packages/ui/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# ---- build stage ----
FROM base AS builder
WORKDIR /app

# Bring in installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/schema/node_modules ./packages/schema/node_modules 2>/dev/null || true
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules 2>/dev/null || true

# Copy source files
COPY packages/schema ./packages/schema
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web
COPY pnpm-workspace.yaml package.json ./

# Build shared packages first
RUN pnpm --filter @threatdex/schema build 2>/dev/null || true
RUN pnpm --filter @threatdex/ui build 2>/dev/null || true

# Build the Next.js app
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- runner stage ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public 2>/dev/null || true

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
