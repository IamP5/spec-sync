# syntax=docker/dockerfile:1
#
# Angular SPA for Cloud Run.
#   build   - installs workspace deps and runs `nx build web` (production), pre-compresses assets
#   runtime - unprivileged nginx serving the static bundle and proxying /api to the API service
#
# Build context: the workspace root (see tools/deploy/web.sh and the root .dockerignore).

ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.29-alpine-slim

# ---------------------------------------------------------------------------- build
FROM ${NODE_IMAGE} AS build
WORKDIR /workspace
ENV CI=true NX_DAEMON=false NX_NO_CLOUD=true

# Dependency layer: reused until a manifest or the lockfile changes. apps/web is an npm
# workspace, so its package.json must be present for `npm ci` to install its packages.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

COPY . .
# Pre-compressed copies let nginx serve gzip without spending CPU per request.
RUN npx nx build web --configuration=production \
    && find dist/apps/web/browser -type f \
         \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' -o -name '*.json' -o -name '*.txt' -o -name '*.ico' \) \
         -exec gzip -9 -k -f {} +

# -------------------------------------------------------------------------- runtime
FROM ${NGINX_IMAGE} AS runtime

# Rendered into /etc/nginx/conf.d/default.conf by the image entrypoint (envsubst) after
# 10-api-upstream.envsh derives the upstream host/port from API_URL.
# PORT is injected by Cloud Run, API_URL by Terraform (infra/environments/dev/main.tf).
ENV PORT=8080
ENV API_URL=http://localhost:8080

COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY apps/web/nginx/headers.conf /etc/nginx/snippets/headers.conf
COPY apps/web/nginx/10-api-upstream.envsh /docker-entrypoint.d/10-api-upstream.envsh
COPY --from=build /workspace/dist/apps/web/browser/ /usr/share/nginx/html/

EXPOSE 8080
