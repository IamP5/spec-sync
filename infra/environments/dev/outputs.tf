output "app_url" {
  description = "Public URL of the SPA (the web Cloud Run service)."
  value       = var.domain != "" ? "https://${var.domain}" : module.web.uri
}

output "api_url" {
  description = "Direct URL of the API service. Browsers reach it through the web service's /api proxy."
  value       = module.api.uri
}

output "domain_dns_records" {
  value = module.web.domain_dns_records
}

output "artifact_registry" {
  description = "Docker registry path. Images: <this>/api:<tag> and <this>/web:<tag>"
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
  }
}
