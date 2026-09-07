# OpenAI models offered in the chat's model selector next to Gemini on Vertex AI.
# The ai service only lists them while OPENAI_API_KEY is set (apps/ai/src/mastra/models.ts).
# The key is created out of band in Secret Manager; Terraform reads metadata only, so the
# payload stays outside state and plans.
data "google_secret_manager_secret" "openai_api_key" {
  project   = var.project_id
  secret_id = "OPENAI_API_KEY"
}

resource "google_secret_manager_secret_iam_member" "ai_openai_api_key" {
  secret_id = data.google_secret_manager_secret.openai_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.ai.member
}
