# dev environment: composes the modules with dev sizing. Copy this folder to
# environments/prod and adjust backend.tf, locals.tf and the values below when needed.

module "services" {
  source = "../../modules/project-services"

  services = [
    "aiplatform.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "cloudscheduler.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "pubsub.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "serviceusage.googleapis.com",
    "sqladmin.googleapis.com",
    "storage.googleapis.com",
    "sts.googleapis.com",
  ]
}

module "registry" {
  source = "../../modules/artifact-registry"

  name       = local.name
  project_id = var.project_id
  region     = var.region
  labels     = local.labels

  depends_on = [module.services]
}

module "network" {
  source = "../../modules/network"

  name   = local.name
  region = var.region

  depends_on = [module.services]
}

module "database" {
  source = "../../modules/database"

  name                = local.name
  region              = var.region
  database_name       = local.app_name
  user_name           = local.app_name
  tier                = "db-f1-micro"
  backups_enabled     = false
  deletion_protection = false
  labels              = local.labels
  private_network     = module.network.network_id

  # The peering must be established before Cloud SQL can allocate a private IP.
  depends_on = [module.services, module.network.private_services_connection]
}

# Dev database only needs to be up during working hours (see cost notes in the README).
# Manual override: `nx run infra:db-start -c dev` / `db-stop` / `db-status`.
module "database_schedule" {
  source = "../../modules/cloud-sql-schedule"

  name           = local.name
  project_id     = var.project_id
  region         = var.region
  instance_name  = module.database.instance_name
  start_schedule = "0 8 * * *"
  stop_schedule  = "0 23 * * *"
  time_zone      = "America/Sao_Paulo"

  depends_on = [module.services]
}

module "events" {
  source = "../../modules/pubsub"

  topic_name    = "${local.name}-events"
  subscriptions = ["api"]
  labels        = local.labels

  depends_on = [module.services]
}

module "files" {
  source = "../../modules/storage-bucket"

  name          = "${var.project_id}-${local.name}-files"
  location      = var.region
  force_destroy = true
  labels        = local.labels

  iam_members = {
    (google_service_account.api.member) = "roles/storage.objectAdmin"
  }
}

# --- API (Spring Boot) -------------------------------------------------------
module "api" {
  source = "../../modules/cloud-run-service"

  name                  = "${local.name}-api"
  project_id            = var.project_id
  region                = var.region
  image                 = var.placeholder_image
  service_account_email = google_service_account.api.email
  labels                = local.labels

  cpu                       = "1"
  memory                    = "1Gi"
  min_instances             = 0
  max_instances             = 2
  startup_cpu_boost         = true
  startup_failure_threshold = 24
  allow_unauthenticated     = true # the web proxy calls it anonymously; Spring Security is the auth layer
  deletion_protection       = false

  cloud_sql_instances = [module.database.connection_name]

  # Direct VPC egress so the Auth connector can reach the database's private IP.
  vpc_access = {
    network    = module.network.network_name
    subnetwork = module.network.run_subnetwork_name
  }

  # Spring Boot relaxed binding: these map to application-cloud.properties / spring-cloud-gcp.
  env = {
    SPRING_PROFILES_ACTIVE                        = "cloud"
    SPRING_CLOUD_GCP_PROJECT_ID                   = var.project_id
    SPRING_CLOUD_GCP_SQL_INSTANCE_CONNECTION_NAME = module.database.connection_name
    SPRING_CLOUD_GCP_SQL_DATABASE_NAME            = module.database.database_name
    SPRING_CLOUD_GCP_SQL_IP_TYPES                 = "PRIVATE"
    SPRING_DATASOURCE_USERNAME                    = module.database.user_name
    APP_STORAGE_BUCKET                            = module.files.name
    APP_PUBSUB_TOPIC                              = module.events.topic_name
    APP_PUBSUB_SUBSCRIPTION                       = module.events.subscription_names["api"]
    SPRING_AI_GOOGLE_GENAI_PROJECT_ID             = var.project_id
    SPRING_AI_GOOGLE_GENAI_LOCATION               = var.region
  }

  secret_env = {
    SPRING_DATASOURCE_PASSWORD = { secret = module.database.password_secret_id }
  }

  depends_on = [
    module.services,
    google_secret_manager_secret_iam_member.api_db_password,
  ]
}

# --- Web (nginx serving the Angular build, proxying /api to the API) ----------
module "web" {
  source = "../../modules/cloud-run-service"

  name                  = "${local.name}-web"
  project_id            = var.project_id
  region                = var.region
  image                 = var.placeholder_image
  service_account_email = google_service_account.web.email
  labels                = local.labels

  cpu                   = "1"
  memory                = "256Mi"
  min_instances         = 0
  max_instances         = 2
  allow_unauthenticated = true
  domain                = var.domain
  # nginx accepts cleartext HTTP/2 (h2c), so the front-end -> container hop runs over
  # HTTP/2 too. Browsers already get HTTP/2 + HTTP/3 from Cloud Run's front end regardless.
  http2 = true

  env = {
    API_URL = module.api.uri # split into an upstream by apps/web/nginx/10-api-upstream.envsh
  }

  depends_on = [module.services]
}

# --- CI identity ---------------------------------------------------------------
module "deployer" {
  source = "../../modules/github-deployer"

  name              = local.name
  project_id        = var.project_id
  github_repository = var.github_repository
  pool_id           = "github-${local.env}"

  impersonable_service_accounts = {
    api = google_service_account.api.name
    web = google_service_account.web.name
  }

  depends_on = [module.services]
}
