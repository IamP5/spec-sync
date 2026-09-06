resource "neo4jaura_instance" "this" {
  name           = var.name
  project_id     = var.project_id
  cloud_provider = "gcp"
  region         = var.region
  type           = var.instance_type
  memory         = var.memory
  storage        = var.storage
  version        = "5"

  lifecycle {
    prevent_destroy = true
  }
}
