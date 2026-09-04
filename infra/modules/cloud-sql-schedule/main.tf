# Starts and stops a Cloud SQL instance on a schedule by PATCHing its activation policy
# through the Cloud SQL Admin API from Cloud Scheduler. Runs as a dedicated service account
# that can only edit Cloud SQL. Manual start/stop uses the same API via
# `nx run infra:db-start|db-stop` (gcloud), or `gcloud scheduler jobs run <job>`.
resource "google_service_account" "scheduler" {
  account_id   = "${var.name}-sql-scheduler"
  display_name = "${var.name} Cloud SQL start/stop scheduler"
}

resource "google_project_iam_member" "scheduler_sql_editor" {
  project = var.project_id
  role    = "roles/cloudsql.editor"
  member  = google_service_account.scheduler.member
}

locals {
  instance_uri = "https://sqladmin.googleapis.com/v1/projects/${var.project_id}/instances/${var.instance_name}"
  jobs = {
    start = { schedule = var.start_schedule, policy = "ALWAYS", description = "Start Cloud SQL ${var.instance_name}" }
    stop  = { schedule = var.stop_schedule, policy = "NEVER", description = "Stop Cloud SQL ${var.instance_name}" }
  }
}

resource "google_cloud_scheduler_job" "this" {
  for_each = local.jobs

  name        = "${var.instance_name}-${each.key}"
  description = each.value.description
  region      = var.region
  schedule    = each.value.schedule
  time_zone   = var.time_zone

  retry_config {
    retry_count          = 3
    min_backoff_duration = "60s"
  }

  http_target {
    uri         = local.instance_uri
    http_method = "PATCH"
    headers     = { "Content-Type" = "application/json" }
    body        = base64encode(jsonencode({ settings = { activationPolicy = each.value.policy } }))

    oauth_token {
      service_account_email = google_service_account.scheduler.email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }

  depends_on = [google_project_iam_member.scheduler_sql_editor]
}
