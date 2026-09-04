output "topic_name" {
  value = google_pubsub_topic.this.name
}

output "subscription_names" {
  value = { for k, s in google_pubsub_subscription.this : k => s.name }
}
