# syntax=docker/dockerfile:1
#
# Angular SPA for Cloud Run.
#   build   - installs workspace deps and runs `nx build web` (production), pre-compresses assets
#   runtime - public unprivileged nginx serving the static bundle
#
# Build context: the workspace root (see tools/deploy/web.sh and the root .dockerignore).

ARG NODE_IMAGE=node:24-alpine
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.29-alpine-slim

# ---------------------------------------------------------------------------- build
FROM ${NODE_IMAGE} AS build
WORKDIR /workspace
ENV CI=true NX_DAEMON=false NX_NO_CLOUD=true

# Dependency layer: reused until a manifest or the lockfile changes. apps/web and apps/ai
# are npm workspaces, so both package.json files must be present for `npm ci` to resolve
# the lockfile (the ai packages are installed but unused here).
# --ignore-scripts skips the root `prepare` script (husky + agent-config sync), which is
# developer tooling that has no place in the image and needs files not copied yet. The
# dependencies that matter at build time (esbuild, lmdb, ...) ship their native binaries
# as optional packages, so they do not rely on postinstall scripts.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/ai/package.json ./apps/ai/
COPY apps/gateway/package.json ./apps/gateway/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --ignore-scripts

COPY . .
# Pre-compressed copies let nginx serve gzip without spending CPU per request.
RUN npx nx build web --configuration=production \
    && find dist/apps/web/browser -type f \
         \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' -o -name '*.json' -o -name '*.txt' -o -name '*.ico' \) \
         -exec gzip -9 -k -f {} +

# -------------------------------------------------------------------------- runtime
FROM ${NGINX_IMAGE} AS runtime

# nginx serves public static assets; the browser calls the Hono gateway for authenticated data.
ENV PORT=8080

COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY apps/web/nginx/headers.conf /etc/nginx/snippets/headers.conf
COPY --from=build /workspace/dist/apps/web/browser/ /usr/share/nginx/html/

EXPOSE 8080
