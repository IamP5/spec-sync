# Service account used by GitHub Actions through Workload Identity Federation (no keys).
# NOTE: pools and providers are soft-deleted for 30 days and their ids cannot be reused in
# that window. Change `pool_id` if you ever destroy and recreate an environment.
resource "google_service_account" "this" {
  account_id   = "${var.name}-deployer"
  display_name = "${var.name} GitHub Actions deployer"
}

resource "google_project_iam_member" "roles" {
  for_each = toset(var.project_roles)

  project = var.project_id
  role    = each.key
  member  = google_service_account.this.member
}

# Lets `gcloud run deploy` attach the runtime service accounts to new revisions.
resource "google_service_account_iam_member" "acts_as" {
  for_each = var.impersonable_service_accounts

  service_account_id = each.value
  role               = "roles/iam.serviceAccountUser"
  member             = google_service_account.this.member
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = var.pool_id
  display_name              = "GitHub Actions (${var.name})"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.actor"            = "assertion.actor"
    "attribute.repository"       = "assertion.repository"
    "attribute.repository_owner" = "assertion.repository_owner"
  }

  attribute_condition = "assertion.repository == \"${var.github_repository}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "wif" {
  service_account_id = google_service_account.this.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}
