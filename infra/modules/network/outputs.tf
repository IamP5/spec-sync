output "network_id" {
  value = google_compute_network.this.id
}

output "network_name" {
  value = google_compute_network.this.name
}

output "run_subnetwork_name" {
  value = google_compute_subnetwork.run.name
}

output "private_services_connection" {
  description = "Depend on this before creating resources that need private services access."
  value       = google_service_networking_connection.services.id
}
