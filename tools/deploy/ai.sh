#!/usr/bin/env bash
# Build the AI image (Mastra bundle + Node runtime, see apps/ai/Dockerfile), push it to
# Artifact Registry and roll it out to Cloud Run. Terraform owns the service definition
# (including the Vertex project/location); this only swaps the image.
source "$(dirname "$0")/common.sh"

IMAGE="${REGISTRY}/ai:${IMAGE_TAG}"

log "building and pushing ${IMAGE}"
build_and_push "${IMAGE}" . --file apps/ai/Dockerfile

log "deploying ${NAME}-ai in ${GCP_REGION}"
deploy_service "${NAME}-ai" "${IMAGE}"
