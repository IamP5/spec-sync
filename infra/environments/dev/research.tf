# Separate credentials for private research requests and extraction/projection workers.
# Human research review uses Firebase identity and never receives these credentials.
resource "random_password" "research_keys" {
  for_each = toset(["research-service-key", "ingestion-worker-key"])
  length   = 48
  special  = false
}

resource "google_secret_manager_secret" "research_keys" {
  for_each  = random_password.research_keys
  secret_id = "${local.name}-${each.key}"
  labels    = local.labels
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "research_keys" {
  for_each    = random_password.research_keys
  secret      = google_secret_manager_secret.research_keys[each.key].id
  secret_data = each.value.result
}

resource "google_secret_manager_secret_iam_member" "research_keys" {
  for_each = {
    for binding in setproduct(["research-service-key", "ingestion-worker-key"], ["api", "ai"]) :
    "${binding[0]}-${binding[1]}" => { secret = binding[0], workload = binding[1] }
  }
  secret_id  = google_secret_manager_secret.research_keys[each.value.secret].id
  role       = "roles/secretmanager.secretAccessor"
  member     = each.value.workload == "api" ? google_service_account.api.member : google_service_account.ai.member
  depends_on = [google_secret_manager_secret_version.research_keys]
}
