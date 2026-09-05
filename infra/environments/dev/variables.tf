variable "project_id" {
  description = "GCP project for this environment. Set with TF_VAR_project_id or terraform.tfvars."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository (owner/name) allowed to deploy through Workload Identity Federation."
  type        = string
}

variable "region" {
  type    = string
  default = "southamerica-east1"
}

variable "vertex_location" {
  description = "Vertex AI location used by the ai service, independent of `region`. Gemini 3.x is only served from `global`; regional endpoints such as us-central1 stop at the 2.5 family."
  type        = string
  default     = "global"
}

variable "domain" {
  description = "Optional custom domain for the web service (region support is limited, see modules/cloud-run-service)."
  type        = string
  default     = ""
}

variable "placeholder_image" {
  description = "Image used when a Cloud Run service is first created; CI rolls out the real images."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}
