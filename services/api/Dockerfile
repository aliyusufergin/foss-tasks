# Backend API service — PowerSync-compatible JWTs (auth) and POST /sync/write.
#
# Built with the REPO ROOT as its build context, not services/api: since the
# monorepo move (#18) the lockfile is the workspace root's, and
# @foss-tasks/domain is a workspace dependency resolved by symlink, so the
# service cannot be installed in isolation (a service-local `npm ci` fails with
# "/package-lock.json: not found"). docker-compose.yml sets `context: .`.
FROM node:22-alpine AS build
WORKDIR /repo
# Manifests first for a cacheable install. Every workspace named in the root
# package.json must have its package.json present or npm rejects the tree; the
# install itself is scoped to this service and the one package it consumes, so
# the app's React Native graph is never pulled into the image.
COPY package.json package-lock.json .npmrc ./
COPY app/package.json ./app/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY services/api/package.json ./services/api/package.json
RUN npm ci --workspace @foss-tasks/api --workspace @foss-tasks/domain --include-workspace-root
# Build the shared domain package (consumed as compiled dist/, ADR-0008 §11)
# before the service that imports it.
COPY packages/domain ./packages/domain
RUN npm run build -w @foss-tasks/domain
COPY services/api ./services/api
RUN npm run build -w @foss-tasks/api

FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json .npmrc ./
COPY app/package.json ./app/package.json
COPY packages/domain/package.json ./packages/domain/package.json
COPY services/api/package.json ./services/api/package.json
RUN npm ci --omit=dev \
      --workspace @foss-tasks/api --workspace @foss-tasks/domain --include-workspace-root

FROM node:22-alpine AS runtime
WORKDIR /repo/services/api
ENV NODE_ENV=production
# Hoisted workspace node_modules holds the service's runtime deps and the
# @foss-tasks/domain symlink, whose target (with its built dist/) is copied next.
COPY --from=deps /repo/node_modules /repo/node_modules
COPY --from=build /repo/packages/domain /repo/packages/domain
COPY services/api/package.json ./package.json
COPY --from=build /repo/services/api/dist ./dist
# Applied on boot by the migration runner (ADR-0008 §12); resolved relative to
# dist/, so it must sit beside it.
COPY services/api/migrations ./migrations
USER node
EXPOSE 6060
CMD ["node", "dist/index.js"]
