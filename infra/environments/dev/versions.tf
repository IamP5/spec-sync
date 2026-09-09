terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 7.0, < 9.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    neo4jaura = {
      source  = "neo4j-labs/neo4jaura"
      version = "1.1.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.24.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# AURA_CLIENT_ID and AURA_CLIENT_SECRET are supplied by the runner environment.
provider "neo4jaura" {}

# CLOUDFLARE_API_TOKEN is supplied by the runner, never stored in Terraform variables.
provider "cloudflare" {}
