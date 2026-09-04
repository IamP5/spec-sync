resource "google_project_service" "this" {
  for_each = toset(var.services)

  service            = each.key
  disable_on_destroy = false
}
