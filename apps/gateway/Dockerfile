# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /workspace
ENV NX_DAEMON=false NX_NO_CLOUD=true CI=true
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/ai/package.json ./apps/ai/
COPY apps/gateway/package.json ./apps/gateway/
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npx nx build gateway
# Derive a standalone lock from the workspace lock, retaining locked dependency versions.
RUN mkdir /runtime-deps \
    && cp apps/gateway/package.json package-lock.json /runtime-deps/
RUN --mount=type=cache,target=/root/.npm \
    cd /runtime-deps \
    && npm install --package-lock-only --ignore-scripts --workspaces=false --no-audit --no-fund \
    && npm ci --omit=dev --ignore-scripts --workspaces=false --no-audit --no-fund

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build --chown=node:node /runtime-deps/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/gateway/package.json ./package.json
COPY --from=build --chown=node:node /workspace/dist/apps/gateway/main.js ./main.js
USER node
EXPOSE 8080
CMD ["node", "main.js"]
