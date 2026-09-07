# Chat history owned by Mastra memory (@mastra/pg) in the `mastra` schema of the
# application database. The Spring API keeps its Flyway-owned schemas untouched.
# The ai service reaches the private IP directly over its VPC egress, so the URL
# carries the address instead of the Cloud SQL connection name.
resource "random_password" "ai_memory" {
  length  = 32
  special = false
}

resource "google_sql_user" "ai_memory" {
  name     = "${local.app_name}-ai"
  instance = module.database.instance_name
  password = random_password.ai_memory.result
}

resource "google_secret_manager_secret" "ai_memory_url" {
  secret_id = "${local.name}-ai-memory-url"
  labels    = local.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "ai_memory_url" {
  secret = google_secret_manager_secret.ai_memory_url.id
  secret_data = format(
    "postgresql://%s:%s@%s:5432/%s?sslmode=require",
    google_sql_user.ai_memory.name,
    urlencode(random_password.ai_memory.result),
    module.database.private_ip_address,
    module.database.database_name,
  )
}

resource "google_secret_manager_secret_iam_member" "ai_memory_url" {
  secret_id = google_secret_manager_secret.ai_memory_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.ai.member
}
