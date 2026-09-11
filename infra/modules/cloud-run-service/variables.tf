variable "name" {
  type = string
}

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "image" {
  description = "Image used when the service is created. Later rollouts happen outside Terraform."
  type        = string
}

variable "service_account_email" {
  type = string
}

variable "port" {
  type    = number
  default = 8080
}

variable "cpu" {
  type    = string
  default = "1"
}

variable "memory" {
  type    = string
  default = "512Mi"
}

variable "min_instances" {
  type    = number
  default = 0
}

variable "max_instances" {
  type    = number
  default = 2
}

variable "startup_cpu_boost" {
  type    = bool
  default = false
}

variable "startup_failure_threshold" {
  description = "Startup probe attempts (5s apart) before the instance is killed."
  type        = number
  default     = 12
}

variable "ingress" {
  type    = string
  default = "INGRESS_TRAFFIC_ALL"
}

variable "allow_unauthenticated" {
  type    = bool
  default = false
}

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "cloud_sql_instances" {
  description = "Cloud SQL connection names to mount under /cloudsql."
  type        = list(string)
  default     = []
}

variable "env" {
  description = "Plain environment variables."
  type        = map(string)
  default     = {}
}

variable "secret_env" {
  description = "Environment variables sourced from Secret Manager: name -> { secret, version }."
  type = map(object({
    secret  = string
    version = optional(string, "latest")
  }))
  default = {}
}

variable "domain" {
  type    = string
  default = ""
}

variable "labels" {
  type    = map(string)
  default = {}
}

variable "http2" {
  description = "Use end-to-end HTTP/2 (cleartext h2c) between Cloud Run's front end and the container. The container must accept h2c with prior knowledge on `port`."
  type        = bool
  default     = false
}

variable "vpc_access" {
  description = "Direct VPC egress: network + subnetwork names. Null keeps the service off the VPC."
  type = object({
    network    = string
    subnetwork = string
    egress     = optional(string, "PRIVATE_RANGES_ONLY")
  })
  default = null
}

variable "cpu_idle" {
  description = "Throttle CPU outside requests. Disable for a resident scheduled worker."
  type        = bool
  default     = true
}

variable "request_timeout" {
  description = "Maximum request duration, including bounded AI research attempts."
  type        = string
  default     = "300s"
}
