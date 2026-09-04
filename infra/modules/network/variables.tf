variable "name" {
  description = "VPC name; also prefixes the subnet and peering range."
  type        = string
}

variable "region" {
  type = string
}

variable "run_subnet_cidr" {
  description = "CIDR of the subnet used by Cloud Run Direct VPC egress."
  type        = string
  default     = "10.10.0.0/24"
}
