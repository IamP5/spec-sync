variable "name" {
  description = "Cloudflare Worker name."
  type        = string
}

variable "account_id" {
  description = "Cloudflare account owning the Worker and zone."
  type        = string
}

variable "zone_id" {
  description = "Existing Cloudflare zone for the custom hostname."
  type        = string
}

variable "hostname" {
  description = "Public frontend hostname, without a scheme or path."
  type        = string
}

variable "origin" {
  description = "HTTPS Cloud Run service URL, shared by all service instances."
  type        = string

  validation {
    condition     = can(regex("^https://[a-z0-9.-]+\\.run\\.app/?$", var.origin))
    error_message = "origin must be an HTTPS run.app service URL without a path or query."
  }
}
