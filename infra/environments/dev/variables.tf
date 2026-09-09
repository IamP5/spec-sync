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
  description = "Optional frontend hostname in the tubadev.com Cloudflare zone; empty uses the Cloud Run URL."
  type        = string
  default     = "specsync.tubadev.com"

  validation {
    condition     = var.domain == "" || can(regex("^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)*tubadev\\.com$", var.domain))
    error_message = "domain must be a hostname in tubadev.com, without a scheme, port or path."
  }
}

variable "placeholder_image" {
  description = "Image used when a Cloud Run service is first created; CI rolls out the real images."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "google_oauth_client_id" {
  description = "Google Web OAuth client ID, shared by the gateway and Identity Platform Google provider."
  type        = string
  validation {
    condition     = endswith(var.google_oauth_client_id, ".apps.googleusercontent.com")
    error_message = "Set a Google Web OAuth client ID."
  }
}

variable "google_oauth_secret_id" {
  description = "Existing Secret Manager secret containing the Google OAuth client secret."
  type        = string
  default     = "GOOGLE_OAUTH_CLIENT_SECRET"
}
