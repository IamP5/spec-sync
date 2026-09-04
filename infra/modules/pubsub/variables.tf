variable "topic_name" {
  type = string
}

variable "subscriptions" {
  description = "Subscription suffixes to create on the topic (e.g. [\"api\"])."
  type        = list(string)
  default     = []
}

variable "labels" {
  type    = map(string)
  default = {}
}
