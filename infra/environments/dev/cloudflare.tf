# The existing tubadev.com zone stays managed outside this environment. The Worker
# custom domain owns only its hostname's DNS record and managed TLS certificate.
module "web_domain" {
  count  = var.domain != "" ? 1 : 0
  source = "../../modules/cloudflare-web-proxy"

  name       = "${local.name}-web-proxy"
  account_id = "afe755ff10df55781f46fe5f9a0ec6b7"
  zone_id    = "69faa03e5a8a6800480b3be448f1eb06"
  hostname   = var.domain
  origin     = module.web.uri
}
