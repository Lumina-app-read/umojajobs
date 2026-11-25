# syntax=docker/dockerfile:1.7
# Image de l'API NestJS. Construction depuis la racine du dépôt :
#   docker build -f infrastructure/docker/api.Dockerfile --target runtime -t umoja-api .
# Cibles : runtime (API, avec Chromium pour l'export PDF) et migrate (migrations Prisma, seed).

ARG NODE_IMAGE=node:24.22.2-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    TURBO_TELEMETRY_DISABLED=1
# openssl : requis par le moteur de migration Prisma.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g pnpm@10.34.5 --no-fund --no-audit
WORKDIR /repo

# --- Construction : dépendances complètes, client Prisma, paquets partagés et API ---
FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@opportinities/api...
# Dépendances de production seules, avec les paquets partagés construits.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @opportinities/api deploy --prod --legacy /out \
 && rm -rf /out/src /out/test /out/scripts \
 && cp -r apps/api/dist /out/dist

# --- Migrations : CLI Prisma et seed (tsx), lancés une fois par déploiement ---
FROM build AS migrate
WORKDIR /repo/apps/api
USER node
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# --- Exécution : Node, dépendances de production et Chromium (export PDF du Career Studio) ---
FROM ${NODE_IMAGE} AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium fonts-liberation fonts-noto-core fonts-noto-color-emoji ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# Cache des polices construit dans l'image : sinon Chromium le reconstruit au premier lancement
# de chaque conteneur (une quinzaine de secondes), et le premier export PDF expire.
RUN fc-cache -f
ENV NODE_ENV=production \
    API_PORT=4000 \
    CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROMIUM_NO_SANDBOX=true
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/api/v1/health/ready').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
