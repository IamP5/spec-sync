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
    "roles/iam.roleAdmin",
    "roles/identityplatform.admin",
    "roles/serviceusage.apiKeysAdmin",
    "roles/iam.workloadIdentityPoolAdmin",
    "roles/secretmanager.admin",
    "roles/run.admin",
    "roles/artifactregistry.admin",
  ]
}

variable "impersonable_service_accounts" {
  description = "Cloud Run runtime service accounts the deployer may act as, keyed by a static label (keys must be known at plan time)."
  type        = map(string)
  default     = {}
}
