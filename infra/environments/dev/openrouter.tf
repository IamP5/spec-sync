# OpenRouter is the model router for every chat, vision, identification, extraction and
# title call (apps/ai/src/mastra/models.ts). Vertex AI stays reachable through Application
# Default Credentials for Google Search grounding only, which OpenRouter cannot serve.
# The key is created out of band in Secret Manager; Terraform reads metadata only, so the
# payload stays outside state and plans.
data "google_secret_manager_secret" "openrouter_api_key" {
  project   = var.project_id
  secret_id = "OPENROUTER_API_KEY"
}

resource "google_secret_manager_secret_iam_member" "ai_openrouter_api_key" {
  secret_id = data.google_secret_manager_secret.openrouter_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.ai.member
}
