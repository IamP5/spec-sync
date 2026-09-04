# State bucket is created by ../../bootstrap. Each environment uses its own prefix.
terraform {
  backend "gcs" {
    bucket = "specsync-tfstate"
    prefix = "environments/dev"
  }
}
