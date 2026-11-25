# syntax=docker/dockerfile:1.7
# Image de l'application web Next.js (serveur autonome). Construction depuis la racine du dépôt :
#   docker build -f infrastructure/docker/web.Dockerfile --build-arg SITE_URL=https://exemple.com -t umoja-web .
# SITE_URL est figée au build (robots.txt, plan du site, adresses canoniques prérendus).

ARG NODE_IMAGE=node:24.22.2-bookworm-slim

FROM ${NODE_IMAGE} AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    TURBO_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@10.34.5 --no-fund --no-audit
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm install --frozen-lockfile
ARG SITE_URL
ARG API_INTERNAL_URL=http://api:4000
RUN test -n "$SITE_URL" || (echo "SITE_URL est obligatoire (--build-arg SITE_URL=https://...)" && exit 1)
ENV SITE_URL=$SITE_URL \
    API_INTERNAL_URL=$API_INTERNAL_URL \
    NODE_ENV=production
RUN pnpm turbo run build --filter=@opportinities/web...

FROM ${NODE_IMAGE} AS runtime
ARG SITE_URL
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    SITE_URL=$SITE_URL \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
