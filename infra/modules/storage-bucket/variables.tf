variable "name" {
  type = string
}

variable "location" {
  type = string
}

variable "versioning" {
  type    = bool
  default = false
}

variable "force_destroy" {
  type    = bool
  default = false
}

variable "iam_members" {
  description = "Map of IAM member -> role granted on the bucket."
  type        = map(string)
  default     = {}
}

variable "labels" {
  type    = map(string)
  default = {}
}
