variable "name" {
  type = string
}

variable "project_id" {
  type = string
}

variable "github_repository" {
  description = "owner/repo allowed to assume the deployer identity."
  type        = string
}

variable "pool_id" {
  type = string
}

variable "project_roles" {
  description = "Project-level roles for the deployer. Broad by design: it runs terraform apply."
  type        = list(string)
  default = [
    "roles/editor",
    "roles/resourcemanager.projectIamAdmin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.workloadIdentityPoolAdmin",
    "roles/secretmanager.admin",
    "roles/run.admin",
    "roles/artifactregistry.admin",
  ]
}

variable "impersonable_service_accounts" {
  description = "Service account resource names the deployer may act as (Cloud Run runtime SAs)."
  type        = list(string)
  default     = []
}
