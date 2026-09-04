# Cloud SQL for PostgreSQL plus an application user whose password lives in Secret Manager.
resource "random_password" "app" {
  length  = 32
  special = false
}

resource "google_sql_database_instance" "this" {
  name                = "${var.name}-pg"
  database_version    = var.database_version
  region              = var.region
  deletion_protection = var.deletion_protection

  settings {
    tier              = var.tier
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = 10
    disk_autoresize   = true
    user_labels       = var.labels

    # Public IP with no authorized networks: reachable only through the Cloud SQL Auth
    # connector (Cloud Run's /cloudsql volume). Avoids paying for a VPC connector.
    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = var.backups_enabled
      point_in_time_recovery_enabled = var.backups_enabled
      start_time                     = "03:00"
    }

    maintenance_window {
      day  = 7
      hour = 4
    }
  }
}

resource "google_sql_database" "app" {
  name     = var.database_name
  instance = google_sql_database_instance.this.name
}

resource "google_sql_user" "app" {
  name     = var.user_name
  instance = google_sql_database_instance.this.name
  password = random_password.app.result
}

resource "google_secret_manager_secret" "password" {
  secret_id = "${var.name}-db-password"
  labels    = var.labels

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "password" {
  secret      = google_secret_manager_secret.password.id
  secret_data = random_password.app.result
}
