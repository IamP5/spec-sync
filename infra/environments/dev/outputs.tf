output "app_url" {
  description = "Public URL of the Angular frontend."
  value       = local.web_origin
}

output "api_url" {
  description = "Direct URL of the API service. Browsers reach it through the gateway's /api proxy."
  value       = module.api.uri
}

output "ai_url" {
  description = "Direct URL of the Mastra AI service. Browsers reach it through the gateway's /ai proxy."
  value       = module.ai.uri
}

output "domain_dns_records" {
  value = module.web.domain_dns_records
}

output "artifact_registry" {
  description = "Docker registry path. Images: <this>/api:<tag>, <this>/web:<tag>, <this>/ai:<tag> and <this>/gateway:<tag>"
  value       = module.registry.registry_url
}

output "files_bucket" {
  value = module.files.name
}

output "cloud_sql_connection_name" {
  value = module.database.connection_name
}

output "github_actions" {
  description = "Values to store as GitHub repository variables for the deploy workflow."
  value = {
    GCP_PROJECT_ID                 = var.project_id
    GCP_REGION                     = var.region
    GCP_WORKLOAD_IDENTITY_PROVIDER = module.deployer.workload_identity_provider
    GCP_DEPLOYER_SERVICE_ACCOUNT   = module.deployer.service_account_email
    APP_DOMAIN                     = var.domain
    GOOGLE_OAUTH_CLIENT_ID         = var.google_oauth_client_id
  }
}

output "database_schedule_jobs" {
  description = "Cloud Scheduler jobs that start/stop the dev database."
  value       = module.database_schedule.job_names
}

output "neo4j_aura" {
  description = "Managed AuraDB instance; database credentials remain in Secret Manager."
  value = {
    instance_id = module.neo4j_aura.instance_id
    name        = module.neo4j_aura.name
    region      = module.neo4j_aura.region
    database    = "neo4j"
  }
}

output "gateway_url" {
  description = "Public authenticated gateway for browser API requests."
  value       = local.gateway_origin
}
