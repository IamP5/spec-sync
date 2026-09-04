output "repository_id" {
  value = google_artifact_registry_repository.this.repository_id
}

output "registry_url" {
  description = "Docker registry path; images live at <registry_url>/<image>:<tag>."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.this.repository_id}"
}
