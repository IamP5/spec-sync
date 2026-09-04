output "name" {
  value = google_cloud_run_v2_service.this.name
}

output "uri" {
  value = google_cloud_run_v2_service.this.uri
}

output "domain_dns_records" {
  description = "DNS records to create for the custom domain (empty when no domain is set)."
  value       = var.domain != "" ? google_cloud_run_domain_mapping.this[0].status[0].resource_records : []
}
