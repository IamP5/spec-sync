# Dedicated VPC for the environment: a subnet for Cloud Run Direct VPC egress and a
# private services access range so Cloud SQL can be reached over private IP only.
resource "google_compute_network" "this" {
  name                    = var.name
  auto_create_subnetworks = false
}

# Direct VPC egress allocates one IP per Cloud Run instance from this subnet; a /24 leaves
# plenty of room for several services with small max_instances.
resource "google_compute_subnetwork" "run" {
  name                     = "${var.name}-run"
  region                   = var.region
  network                  = google_compute_network.this.id
  ip_cidr_range            = var.run_subnet_cidr
  private_ip_google_access = true
}

# Range handed to Google-managed services (Cloud SQL) via VPC peering.
resource "google_compute_global_address" "services" {
  name          = "${var.name}-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.this.id
}

resource "google_service_networking_connection" "services" {
  network                 = google_compute_network.this.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.services.name]
  deletion_policy         = "ABANDON"
}

# Private Google Access routes run.app requests through the VPC, satisfying internal
# Cloud Run ingress while PRIVATE_RANGES_ONLY retains direct Internet egress for AI.
resource "google_dns_managed_zone" "run" {
  name       = "${var.name}-run"
  dns_name   = "run.app."
  visibility = "private"
  private_visibility_config {
    networks {
      network_url = google_compute_network.this.id
    }
  }
}

resource "google_dns_record_set" "run" {
  name         = "run.app."
  managed_zone = google_dns_managed_zone.run.name
  type         = "A"
  ttl          = 300
  rrdatas      = ["199.36.153.8", "199.36.153.9", "199.36.153.10", "199.36.153.11"]
}

resource "google_dns_record_set" "run_wildcard" {
  name         = "*.run.app."
  managed_zone = google_dns_managed_zone.run.name
  type         = "CNAME"
  ttl          = 300
  rrdatas      = ["run.app."]
}
