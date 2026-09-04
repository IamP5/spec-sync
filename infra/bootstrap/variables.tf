variable "project_id" {
  description = "GCP project that hosts the Terraform state bucket. Set with TF_VAR_project_id."
  type        = string
}

variable "region" {
  type    = string
  default = "southamerica-east1"
}

variable "state_bucket_name" {
  description = "Globally unique name for the state bucket. Must match backend.tf in every environment."
  type        = string
  default     = "specsync-tfstate"
}
