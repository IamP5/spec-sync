variable "name" {
  type = string
}

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "labels" {
  type    = map(string)
  default = {}
}

variable "keep_count" {
  description = "Most recent image versions to always keep."
  type        = number
  default     = 10
}

variable "delete_older_than_days" {
  type    = number
  default = 30
}
