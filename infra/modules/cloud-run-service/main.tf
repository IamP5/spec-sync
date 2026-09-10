# Generic Cloud Run v2 service. The container image is only used on creation: CI rolls out
# new images with `gcloud run deploy`, so Terraform ignores image drift afterwards.
resource "google_cloud_run_v2_service" "this" {
  name                = var.name
  location            = var.region
  ingress             = var.ingress
  deletion_protection = var.deletion_protection
  labels              = var.labels

  template {
    timeout         = var.request_timeout
    service_account = var.service_account_email
    labels          = var.labels

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    dynamic "vpc_access" {
      for_each = var.vpc_access == null ? [] : [var.vpc_access]
      content {
        egress = vpc_access.value.egress
        network_interfaces {
          network    = vpc_access.value.network
          subnetwork = vpc_access.value.subnetwork
        }
      }
    }

    dynamic "volumes" {
      for_each = length(var.cloud_sql_instances) > 0 ? [1] : []
      content {
        name = "cloudsql"
        cloud_sql_instance {
          instances = var.cloud_sql_instances
        }
      }
    }

    containers {
      image = var.image

      ports {
        name           = var.http2 ? "h2c" : "http1"
        container_port = var.port
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle          = var.cpu_idle
        startup_cpu_boost = var.startup_cpu_boost
      }

      dynamic "volume_mounts" {
        for_each = length(var.cloud_sql_instances) > 0 ? [1] : []
        content {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }

      startup_probe {
        tcp_socket {
          port = var.port
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = var.startup_failure_threshold
      }

      dynamic "env" {
        for_each = var.env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret
              version = env.value.version
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  count = var.allow_unauthenticated ? 1 : 0

  name     = google_cloud_run_v2_service.this.name
  location = google_cloud_run_v2_service.this.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Optional custom domain. Cloud Run domain mappings are a preview feature limited to a few
# regions (us-central1, us-east1, us-east4, us-west1, europe-west1, europe-west4,
# europe-north1, asia-east1, asia-northeast1, asia-southeast1).
resource "google_cloud_run_domain_mapping" "this" {
  count = var.domain != "" ? 1 : 0

  name     = var.domain
  location = var.region

  metadata {
    namespace = var.project_id
    labels    = var.labels
  }

  spec {
    route_name = google_cloud_run_v2_service.this.name
  }
}
