resource "google_pubsub_topic" "this" {
  name   = var.topic_name
  labels = var.labels
}

resource "google_pubsub_subscription" "this" {
  for_each = toset(var.subscriptions)

  name   = "${var.topic_name}-${each.key}"
  topic  = google_pubsub_topic.this.id
  labels = var.labels

  ack_deadline_seconds       = 30
  message_retention_duration = "604800s" # 7 days

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}
