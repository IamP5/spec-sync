output "enabled" {
  description = "Depend on this to make sure APIs are enabled first."
  value       = [for s in google_project_service.this : s.service]
}
