output "job_names" {
  description = "Scheduler job names keyed by start/stop; run manually with `gcloud scheduler jobs run`."
  value       = { for k, j in google_cloud_scheduler_job.this : k => j.name }
}
