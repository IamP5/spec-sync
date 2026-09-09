resource "cloudflare_workers_script" "this" {
  account_id         = var.account_id
  script_name        = var.name
  main_module        = "worker.mjs"
  content_file       = "${path.module}/worker.mjs"
  content_sha256     = filesha256("${path.module}/worker.mjs")
  compatibility_date = "2026-09-09"

  bindings = [
    {
      name = "ORIGIN"
      type = "plain_text"
      text = var.origin
    },
    {
      name = "PUBLIC_HOSTNAME"
      type = "plain_text"
      text = var.hostname
    },
  ]
}

resource "cloudflare_workers_custom_domain" "this" {
  account_id = var.account_id
  zone_id    = var.zone_id
  hostname   = var.hostname
  service    = cloudflare_workers_script.this.script_name
}
