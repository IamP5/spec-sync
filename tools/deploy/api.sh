#!/usr/bin/env bash
# Build the API image (Gradle build + AOT-cached runtime, see apps/api/Dockerfile), push it
# to Artifact Registry and roll it out to Cloud Run. Terraform owns the service definition.
source "$(dirname "$0")/common.sh"

IMAGE="${REGISTRY}/api:${IMAGE_TAG}"

log "building and pushing ${IMAGE}"
build_and_push "${IMAGE}" apps/api

log "deploying ${NAME}-api in ${GCP_REGION}"
deploy_service "${NAME}-api" "${IMAGE}"
