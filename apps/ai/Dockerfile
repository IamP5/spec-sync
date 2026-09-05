# syntax=docker/dockerfile:1
#
# Mastra AI service for Cloud Run.
#   build   - installs workspace deps and runs `nx build ai` (`mastra build`)
#   runtime - plain Node, non-root, serving the self-contained .mastra/output bundle
#
# Build context: the workspace root (see tools/deploy/ai.sh and the root .dockerignore).

ARG NODE_IMAGE=node:24-alpine

# ---------------------------------------------------------------------------- build
FROM ${NODE_IMAGE} AS build
WORKDIR /workspace
ENV CI=true NX_DAEMON=false NX_NO_CLOUD=true

# Dependency layer: reused until a manifest or the lockfile changes. Every npm workspace
# package.json must be present for `npm ci` to resolve the lockfile. --ignore-scripts
# skips the root `prepare` script (husky + agent-config sync), developer tooling that
# needs files not copied yet.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/ai/package.json ./apps/ai/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --ignore-scripts

COPY . .
# `mastra build` bundles src/mastra into apps/ai/.mastra/output and installs that
# bundle's own production node_modules (Hono server, provider SDK, ...).
RUN --mount=type=cache,target=/root/.npm \
    npx nx build ai

# -------------------------------------------------------------------------- runtime
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

# PORT is injected by Cloud Run. Mastra binds to localhost unless MASTRA_HOST says
# otherwise, so the container would not be reachable without it. Vertex project and
# location are set by Terraform (infra/environments/dev/main.tf). The CopilotKit
# runtime phones home unless told not to.
ENV NODE_ENV=production \
    PORT=8080 \
    MASTRA_HOST=0.0.0.0 \
    MASTRA_SKIP_DOTENV=true \
    COPILOTKIT_TELEMETRY_DISABLED=true

COPY --from=build --chown=node:node /workspace/apps/ai/.mastra/output/ ./

USER node
EXPOSE 8080

CMD ["node", "index.mjs"]
