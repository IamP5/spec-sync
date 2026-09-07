#!/usr/bin/env bash
source "$(dirname "$0")/common.sh"
IMAGE="${REGISTRY}/gateway:${IMAGE_TAG}"
log "building and pushing ${IMAGE}"
build_and_push "${IMAGE}" . --file apps/gateway/Dockerfile
log "deploying ${NAME}-gateway in ${GCP_REGION}"
deploy_service "${NAME}-gateway" "${IMAGE}"
