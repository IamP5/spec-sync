variable "name" {
  type = string
}

variable "public_access_prevention" {
  description = "Keep enforced unless explicitly publishing a dedicated public bucket."
  type        = string
  default     = "enforced"
  validation {
    condition     = contains(["enforced", "inherited"], var.public_access_prevention)
    error_message = "Public access prevention must be enforced or inherited."
  }
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
