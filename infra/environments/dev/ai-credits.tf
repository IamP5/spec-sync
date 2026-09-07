# Shared secret between the ai and the api service for the AI-credits wallet.
#
# The wallet lives in the API under /api/internal/ai-credits/**; the ai service is
# its only caller, because it is the single place that verifies the user's Firebase
# token. The API compares this key in constant time before it trusts the uid in the
# path, and requires the Cloud Run invoker identity on top of it.
#
# The same variable is the feature flag on both sides: unset, the ai service neither
# meters nor blocks and /chat/credits answers { "enabled": false }. Locally it goes
# into apps/ai/.env and apps/api/.env.local instead.
resource "random_password" "credits_service_key" {
  length  = 48
  special = false
}

resource "google_secret_manager_secret" "credits_service_key" {
  secret_id = "${local.name}-credits-service-key"
  labels    = local.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "credits_service_key" {
  secret      = google_secret_manager_secret.credits_service_key.id
  secret_data = random_password.credits_service_key.result
}

resource "google_secret_manager_secret_iam_member" "ai_credits_service_key" {
  secret_id = google_secret_manager_secret.credits_service_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.ai.member
}

resource "google_secret_manager_secret_iam_member" "api_credits_service_key" {
  secret_id = google_secret_manager_secret.credits_service_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.api.member
}
