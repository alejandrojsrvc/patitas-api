# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma.config.ts ./
COPY scripts/database-safety.ts ./scripts/database-safety.ts

RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY . .

RUN pnpm build

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./
COPY --from=build --chown=node:node /app/scripts/database-safety.ts ./scripts/database-safety.ts
COPY --from=build --chown=node:node /app/scripts/create-production-admin.mjs ./scripts/create-production-admin.mjs
COPY --chown=node:node docker-entrypoint.sh /usr/local/bin/docker-entrypoint

RUN chmod +x /usr/local/bin/docker-entrypoint

USER node

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint"]
CMD ["node", "dist/main.js"]
