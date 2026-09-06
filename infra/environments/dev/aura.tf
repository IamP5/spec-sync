# Adopt the populated AuraDB instance without creating a second database.
# Aura's project UUID is independent of var.project_id (the GCP project).
module "neo4j_aura" {
  source = "../../modules/neo4j-aura"

  name          = "My instance"
  project_id    = "5fb8597f-1eec-4da7-b44e-88fc721d8736"
  region        = "us-central1"
  instance_type = "professional-db"
  memory        = "2GB"
  storage       = "4GB"
}

import {
  to = module.neo4j_aura.neo4jaura_instance.this
  id = "6b4eeb6d"
}

# Read metadata only: secret payloads stay outside Terraform state and plans.
data "google_secret_manager_secret" "neo4j" {
  for_each = toset(["NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD"])

  project   = var.project_id
  secret_id = each.value
}

resource "google_secret_manager_secret_iam_member" "ai_neo4j" {
  for_each = data.google_secret_manager_secret.neo4j

  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.ai.member
}
