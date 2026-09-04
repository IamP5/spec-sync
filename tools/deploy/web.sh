#!/usr/bin/env bash
# Build the web image (Angular build + nginx runtime, see apps/web/Dockerfile), push it to
# Artifact Registry and roll it out to Cloud Run. Terraform owns the service definition
# (including API_URL); this only swaps the image.
source "$(dirname "$0")/common.sh"

IMAGE="${REGISTRY}/web:${IMAGE_TAG}"

log "building and pushing ${IMAGE}"
build_and_push "${IMAGE}" . --file apps/web/Dockerfile

log "deploying ${NAME}-web in ${GCP_REGION}"
deploy_service "${NAME}-web" "${IMAGE}"
