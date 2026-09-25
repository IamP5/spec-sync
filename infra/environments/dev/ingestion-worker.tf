# Cloud Scheduler drives the API's durable ingestion queue (extractions and graph projections), so
# the API scales to zero instead of keeping a resident poller instance with CPU always allocated
# (1 vCPU / 1 GiB around the clock cost about R$12 a day). The job runs only while Cloud SQL is up
# (module.database_schedule in main.tf). Cloud Scheduler never overlaps runs of one job, so work
# is still processed one unit at a time; POST /api/internal/ingestion/drain keeps claiming work
# until the queue is empty or its time budget is spent.

locals {
  # Deterministic run.app URL, known before the service exists: the audience of the scheduler's
  # ID token, which the API verifies itself because the gateway proxies every /api/** path.
  api_url = "https://${local.name}-api-${data.google_project.current.number}.${var.region}.run.app"
}

resource "google_service_account" "ingestion_trigger" {
  account_id   = "${local.name}-ingestion-trigger"
  display_name = "${local.name} ingestion worker trigger (Cloud Scheduler)"
}

resource "google_cloud_run_v2_service_iam_member" "ingestion_trigger_invoker" {
  project  = var.project_id
  location = var.region
  name     = module.api.name
  role     = "roles/run.invoker"
  member   = google_service_account.ingestion_trigger.member
}

resource "google_cloud_scheduler_job" "ingestion_drain" {
  name        = "${local.name}-ingestion-drain"
  description = "Drain the API's ingestion queue (extractions and graph projections)"
  region      = var.region
  # Every minute from 08:00 to 22:59, the window in which Cloud SQL runs.
  schedule  = "* 8-22 * * *"
  time_zone = "America/Sao_Paulo"
  # The API stops starting cycles after 3 minutes, and one cycle can take about 24.5 minutes.
  # 30 minutes is Cloud Scheduler's maximum for HTTP targets; the API's request_timeout matches.
  attempt_deadline = "1800s"

  # The next run, a minute later, is the retry.
  retry_config {
    retry_count = 0
  }

  http_target {
    uri         = "${local.api_url}/api/internal/ingestion/drain"
    http_method = "POST"

    oidc_token {
      service_account_email = google_service_account.ingestion_trigger.email
      audience              = local.api_url
    }
  }

  depends_on = [module.services, google_cloud_run_v2_service_iam_member.ingestion_trigger_invoker]
}
