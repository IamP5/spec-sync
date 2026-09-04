variable "name" {
  description = "Prefix for the scheduler service account."
  type        = string
}

variable "project_id" {
  type = string
}

variable "region" {
  description = "Cloud Scheduler region (must support Scheduler, e.g. southamerica-east1)."
  type        = string
}

variable "instance_name" {
  description = "Cloud SQL instance name (not the connection name)."
  type        = string
}

variable "start_schedule" {
  description = "Cron expression for starting the instance."
  type        = string
}

variable "stop_schedule" {
  description = "Cron expression for stopping the instance."
  type        = string
}

variable "time_zone" {
  description = "IANA time zone the cron expressions are evaluated in."
  type        = string
  default     = "Etc/UTC"
}
