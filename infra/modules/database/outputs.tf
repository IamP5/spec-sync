output "connection_name" {
  value = google_sql_database_instance.this.connection_name
}

output "database_name" {
  value = google_sql_database.app.name
}

output "user_name" {
  value = google_sql_user.app.name
}

output "password_secret_id" {
  description = "Secret Manager secret id holding the user's password."
  value       = google_secret_manager_secret.password.secret_id
}

output "password_secret_name" {
  description = "Fully qualified secret resource name (for IAM bindings)."
  value       = google_secret_manager_secret.password.id
}
