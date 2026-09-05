# Runtime identities for the Cloud Run services.
resource "google_service_account" "api" {
  account_id   = "${local.name}-api"
  display_name = "${local.name} API (Cloud Run)"
}

resource "google_project_iam_member" "api" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/pubsub.publisher",
    "roles/pubsub.subscriber",
    "roles/aiplatform.user",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])

  project = var.project_id
  role    = each.key
  member  = google_service_account.api.member
}

resource "google_secret_manager_secret_iam_member" "api_db_password" {
  secret_id = module.database.password_secret_name
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.api.member
}

# The Mastra AI service only talks to Vertex AI (Application Default Credentials of
# this account, no keys) and writes logs/metrics.
resource "google_service_account" "ai" {
  account_id   = "${local.name}-ai"
  display_name = "${local.name} AI (Cloud Run)"
}

resource "google_project_iam_member" "ai" {
  for_each = toset([
    "roles/aiplatform.user",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])

  project = var.project_id
  role    = each.key
  member  = google_service_account.ai.member
}

resource "google_service_account" "web" {
  account_id   = "${local.name}-web"
  display_name = "${local.name} web (Cloud Run)"
}

resource "google_project_iam_member" "web" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = google_service_account.web.member
}
