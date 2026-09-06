variable "name" {
  description = "Display name of the AuraDB instance."
  type        = string
}

variable "project_id" {
  description = "Aura project UUID (tenant_id in the Aura API), distinct from the GCP project ID."
  type        = string
}

variable "region" {
  description = "GCP region of the AuraDB instance; changing it requires replacement."
  type        = string
}

variable "instance_type" {
  description = "AuraDB tier, such as professional-db; changing it requires replacement."
  type        = string
}

variable "memory" {
  description = "Provisioned memory, such as 2GB."
  type        = string
}

variable "storage" {
  description = "Provisioned storage, such as 4GB."
  type        = string
}
