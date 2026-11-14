# Build do dashboard (Next.js standalone) a partir da RAIZ do monorepo:
#   docker compose up web   (ou: docker build -f apps/web/Dockerfile .)

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace apps/web --workspace packages/shared --no-audit --no-fund

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /repo
COPY --from=deps /repo ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# NEXT_PUBLIC_* é inlined no bundle do browser em build-time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    STANDALONE=1
RUN npm run build --workspace apps/web

# ---------- runner ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
# outputFileTracingRoot = raiz do monorepo → standalone espelha a árvore do repo
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
