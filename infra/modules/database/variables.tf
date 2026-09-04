variable "name" {
  description = "Prefix for the instance and secret names."
  type        = string
}

variable "region" {
  type = string
}

variable "database_name" {
  type = string
}

variable "user_name" {
  type = string
}

variable "database_version" {
  type    = string
  default = "POSTGRES_17"
}

variable "tier" {
  type    = string
  default = "db-f1-micro"
}

variable "backups_enabled" {
  type    = bool
  default = false
}

variable "deletion_protection" {
  type    = bool
  default = false
}

variable "labels" {
  type    = map(string)
  default = {}
}

variable "private_network" {
  description = "Self link / id of the VPC the instance gets its private IP from."
  type        = string
}
