#!/usr/bin/env bash
# Shared settings for the deploy scripts. Values come from the environment (CI sets them
# from GitHub repository variables; locally export them or use `direnv`).
set -euo pipefail

: "${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
: "${GCP_REGION:=southamerica-east1}"
: "${DEPLOY_ENV:=dev}"
: "${APP_NAME:=specsync}"

NAME="${APP_NAME}-${DEPLOY_ENV}"
GIT_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"
IMAGE_TAG="${IMAGE_TAG:-${GIT_SHA:0:12}}"
REGISTRY="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${NAME}"

log() { printf '\n\033[1;34m[deploy:%s]\033[0m %s\n' "$DEPLOY_ENV" "$*"; }

# build_and_push <image> <build-context> [extra docker build args...]
# Multi-stage build with BuildKit, pushed straight to Artifact Registry. When the active
# buildx builder supports it (docker-container driver, as set up in CI), build layers are
# also cached in the registry under `<repo>:buildcache` so unchanged stages are skipped.
build_and_push() {
  local image="$1" context="$2"
  shift 2
  local -a cache_args=()
  if docker buildx inspect 2>/dev/null | grep -Eq '^Driver: +docker-container'; then
    local cache_ref="${image%:*}:buildcache"
    cache_args=(--cache-from "type=registry,ref=${cache_ref}" --cache-to "type=registry,ref=${cache_ref},mode=max")
  fi
  docker buildx build \
    --platform linux/amd64 \
    --provenance=false --sbom=false \
    --tag "${image}" \
    --push \
    "${cache_args[@]}" \
    "$@" \
    "${context}"
}

# deploy_service <service> <image>: swap the image on the Cloud Run service Terraform owns.
deploy_service() {
  local service="$1" image="$2"
  gcloud run deploy "${service}" \
    --project "${GCP_PROJECT_ID}" \
    --region "${GCP_REGION}" \
    --image "${image}" \
    --quiet
  gcloud run services describe "${service}" \
    --project "${GCP_PROJECT_ID}" --region "${GCP_REGION}" \
    --format 'value(status.url)'
}
