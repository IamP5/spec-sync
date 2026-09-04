locals {
  env      = "dev"
  app_name = "specsync"
  name     = "${local.app_name}-${local.env}"

  labels = {
    app         = local.app_name
    environment = local.env
    managed_by  = "terraform"
  }
}
