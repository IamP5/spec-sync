# The gateway is the sole public Cloud Run service. OAuth client registration and
# consent-screen configuration happen in Google Cloud; keep the client secret in
# Secret Manager before applying (see apps/gateway/README.md).
data "google_project" "current" {
  project_id = var.project_id
}

locals {
  gateway_host   = "${local.name}-gateway-${data.google_project.current.number}.${var.region}.run.app"
  gateway_origin = var.domain != "" ? "https://${var.domain}" : "https://${local.gateway_host}"
}

resource "google_identity_platform_config" "default" {
  project = var.project_id
  authorized_domains = distinct(concat(
    [local.gateway_host, "localhost"],
    var.domain != "" ? [var.domain] : [],
  ))
  depends_on = [module.services]
}

# Adopt the Identity Platform setup completed in the Google Cloud console.
import {
  to = google_identity_platform_config.default
  id = "projects/${var.project_id}/config"
}

data "google_secret_manager_secret_version" "google_oauth" {
  secret = var.google_oauth_secret_id
}

resource "google_identity_platform_default_supported_idp_config" "google" {
  project       = var.project_id
  idp_id        = "google.com"
  enabled       = true
  client_id     = var.google_oauth_client_id
  client_secret = data.google_secret_manager_secret_version.google_oauth.secret_data
  depends_on    = [google_identity_platform_config.default]
}

import {
  to = google_identity_platform_default_supported_idp_config.google
  id = "projects/${var.project_id}/defaultSupportedIdpConfigs/google.com"
}

resource "google_apikeys_key" "identity" {
  name         = "${local.name}-identity"
  display_name = "${local.name} Identity Platform server exchange"
  project      = var.project_id
  restrictions {
    api_targets {
      service = "identitytoolkit.googleapis.com"
    }
  }
  depends_on = [module.services]
}

resource "google_service_account" "gateway" {
  account_id   = "${local.name}-gateway"
  display_name = "${local.name} gateway (Cloud Run)"
}

# Session creation and revocation checks only; assigning roles is an operator action.
resource "google_project_iam_custom_role" "gateway_identity" {
  role_id     = "specsyncGatewayIdentity${title(local.env)}"
  title       = "SpecSync gateway session authentication"
  project     = var.project_id
  permissions = ["firebaseauth.users.get", "firebaseauth.users.createSession"]
}

resource "google_project_iam_member" "gateway_identity" {
  project = var.project_id
  role    = google_project_iam_custom_role.gateway_identity.name
  member  = google_service_account.gateway.member
}

resource "google_secret_manager_secret_iam_member" "gateway_oauth" {
  secret_id = var.google_oauth_secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.gateway.member
}

module "gateway" {
  source = "../../modules/cloud-run-service"

  name                  = "${local.name}-gateway"
  project_id            = var.project_id
  region                = var.region
  image                 = var.placeholder_image
  service_account_email = google_service_account.gateway.email
  labels                = local.labels
  memory                = "512Mi"
  allow_unauthenticated = true
  domain                = var.domain

  vpc_access = {
    network    = module.network.network_name
    subnetwork = module.network.run_subnetwork_name
  }

  env = {
    NODE_ENV                  = "production"
    GOOGLE_CLOUD_PROJECT      = var.project_id
    PUBLIC_ORIGIN             = local.gateway_origin
    GOOGLE_CLIENT_ID          = var.google_oauth_client_id
    IDENTITY_PLATFORM_API_KEY = google_apikeys_key.identity.key_string
    API_URL                   = module.api.uri
    AI_URL                    = module.ai.uri
    WEB_URL                   = module.web.uri
  }
  secret_env = {
    GOOGLE_CLIENT_SECRET = { secret = var.google_oauth_secret_id }
  }
  depends_on = [
    module.services,
    google_identity_platform_default_supported_idp_config.google,
    google_secret_manager_secret_iam_member.gateway_oauth,
    google_project_iam_member.gateway_identity,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "gateway_invoker" {
  for_each = { api = module.api.name, ai = module.ai.name, web = module.web.name }
  project  = var.project_id
  location = var.region
  name     = each.value
  role     = "roles/run.invoker"
  member   = google_service_account.gateway.member
}

# Existing service workflows also need authenticated internal access.
resource "google_cloud_run_v2_service_iam_member" "ai_api_invoker" {
  project  = var.project_id
  location = var.region
  name     = module.api.name
  role     = "roles/run.invoker"
  member   = google_service_account.ai.member
}

resource "google_cloud_run_v2_service_iam_member" "api_ai_invoker" {
  project  = var.project_id
  location = var.region
  name     = module.ai.name
  role     = "roles/run.invoker"
  member   = google_service_account.api.member
}

# Transfer ownership of an existing custom-domain resource to the gateway.
moved {
  from = module.web.google_cloud_run_domain_mapping.this[0]
  to   = module.gateway.google_cloud_run_domain_mapping.this[0]
}
