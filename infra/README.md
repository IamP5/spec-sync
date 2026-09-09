# infra

Terraform for the Google Cloud, Cloudflare and Neo4j AuraDB environments of SpecSync, managed through Nx with
[`@nx-extend/terraform`](https://github.com/tripss/nx-extend/tree/master/packages/terraform).

## Layout

```
infra/
├── bootstrap/            # state bucket + prerequisite APIs; local state, applied once by a human
├── modules/              # reusable building blocks, no environment knowledge
│   ├── project-services/ # enable APIs
│   ├── artifact-registry/
│   ├── network/          # VPC, Direct VPC egress subnet, private services access peering
│   ├── database/         # Cloud SQL Postgres + app user + password in Secret Manager
│   ├── neo4j-aura/       # AuraDB on GCP, protected against destruction
│   ├── cloud-sql-schedule/ # Cloud Scheduler jobs that start/stop the instance (dev cost control)
│   ├── pubsub/           # topic + subscriptions
│   ├── storage-bucket/
│   ├── cloud-run-service/# generic Cloud Run v2 service (used for gateway, api, ai and web)
│   ├── cloudflare-web-proxy/ # Worker + custom hostname, DNS and managed HTTPS
│   └── github-deployer/  # deployer SA + Workload Identity Federation for GitHub Actions
└── environments/
    └── dev/              # one root module per environment: backend, sizing, composition
```

Each environment is an independent Terraform root with its own state prefix in the shared
bucket. Sizing and protection flags are plain values in `environments/<env>/main.tf`, so the
diff between environments is readable in one file. `prod` does not exist yet; see "Adding an
environment".

## Topology

```
  users ──► specsync.tubadev.com (Cloudflare Worker) ──► public Cloud Run "web"
                                                          (nginx: Angular SPA + Google login)
  users ──► public Cloud Run "gateway" (Hono: verified ID tokens and role claims)
                 ├──► private Cloud Run "api" (Spring Boot)
                 │        ├──► Cloud SQL (private IP, Direct VPC egress + Auth connector)
                 │        ├──► Pub/Sub + GCS + Vertex AI
                 │        └──► private AI ingestion worker (Cloud Run IAM)
                 └──► private Cloud Run "ai" (Mastra, streamed chat)
                          ├──► API catalog (Cloud Run IAM)
                          └──► AuraDB + Vertex AI
  GitHub Actions ──► Workload Identity Federation ──► deployer service account (no keys)
```

The browser loads the public SPA and calls the public gateway directly. The gateway proxies `/api` to Spring Boot and exposes the AI chat/model routes under `/ai`.
Both backend services require Cloud Run IAM and internal ingress. Private
`run.app` DNS plus Direct VPC egress keeps their calls on the environment VPC.
External AI providers remain reachable without Cloud NAT. Gateway Google sign-in,
role claims, local startup and the required first deployment steps are documented
in [the gateway guide](../apps/gateway/README.md).

There is no load balancer. Hono CORS allows exactly the configured frontend origin. AI remains stateless; AuraDB
stores the vehicle graph. The Vertex location is independent of the Cloud Run
region (`vertex_location`, default `global`).

## Targets

| Target                           | What it does                                                               |
| -------------------------------- | -------------------------------------------------------------------------- |
| `nx run infra:bootstrap-apply`   | create the state bucket (local state in `bootstrap/`, run once)            |
| `nx run infra:initialize -c dev` | `terraform init` for an environment                                        |
| `nx run infra:plan -c dev`       | plan an environment (runs `initialize` first)                              |
| `nx run infra:apply -c dev`      | apply; environments used by CI are `-auto-approve`                         |
| `nx run infra:output -c dev`     | `terraform output -json`                                                   |
| `nx run infra:destroy -c dev`    | tear an environment down (interactive)                                     |
| `nx run infra:validate`          | offline `terraform validate` of `bootstrap` and every environment          |
| `nx run infra:fmt` / `fmt-check` | format / check formatting of the whole folder (`fmt-check` in CI)          |
| `nx run infra:db-start -c dev`   | start the Cloud SQL instance now (manual override of the schedule)         |
| `nx run infra:db-stop -c dev`    | stop it now; `db-status` shows state and activation policy                 |
| `nx run api:deploy`              | multi-stage Docker build (Gradle + AOT cache), push, `gcloud run deploy`   |
| `nx run web:deploy`              | multi-stage Docker build (Angular + nginx), push, `gcloud run deploy`      |
| `nx run gateway:deploy`          | build the Hono gateway image, push and deploy                              |
| `nx run ai:deploy`               | multi-stage Docker build (Mastra bundle + Node), push, `gcloud run deploy` |

`-c <env>` selects the environment (the Nx configuration sets the Terraform working directory).
Variables come from `TF_VAR_*` environment variables or a git-ignored
`environments/<env>/terraform.tfvars` (see `terraform.tfvars.example`). Deploy scripts read
`GCP_PROJECT_ID`, `GCP_REGION` and `DEPLOY_ENV`.

`npm exec -- nx run infra:test` verifies the guarded Aura import metadata repair and the web proxy.

## First-time setup

1. Create a GCP project with billing enabled and `gcloud auth application-default login` as an
   owner.
2. Pick a globally unique state bucket name. Set it in
   [`bootstrap/variables.tf`](bootstrap/variables.tf) and in every
   `environments/<env>/backend.tf` (default `specsync-tfstate`).
3. Configure the Aura instance and secrets described below, then bootstrap the state bucket
   and apply the environment:

   ```bash
   export TF_VAR_project_id=<gcp-project-id>
   export TF_VAR_github_repository=<owner>/<repo>
   npm exec -- nx run infra:bootstrap-apply
   npm exec -- nx run infra:apply -c dev
   ```

4. Copy the `github_actions` output (`nx run infra:output -c dev`) into the repository's
   Actions **variables**: `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WORKLOAD_IDENTITY_PROVIDER`,
   `GCP_DEPLOYER_SERVICE_ACCOUNT`, `GOOGLE_OAUTH_CLIENT_ID`. Credentials live in GCP Secret Manager;
   no GitHub repository secrets or GCP service-account keys are needed.
5. Configure the Cloudflare API token described below before applying the dev environment.
   Terraform creates the Worker custom domain, DNS record and certificate automatically.
6. Push to `main`. The first `Deploy` run replaces the placeholder images of the three Cloud
   Run services. Use "Run workflow" with `all=true` if the first run picks up nothing.

## Cloudflare frontend domain

The dev frontend uses **https://specsync.tubadev.com**. The existing `tubadev.com` zone
and account are referenced in [`environments/dev/cloudflare.tf`](environments/dev/cloudflare.tf).
Terraform manages only the new Worker and its custom domain; the zone's other DNS records
stay outside this state. No Google load balancer, Cloud Run domain mapping, Cloudflare paid
subscription, or separate DNS record resource is needed.

The Worker sends requests over HTTPS to `module.web.uri`, with the Cloud Run hostname in
the `Host` header. Cloud Run distributes requests across the service's instances. Paths,
queries and streaming responses are preserved. HTTP redirects to HTTPS; redirects back to
the origin are rewritten to the public hostname. External redirects are returned to the
browser. Successful responses keep the origin's cache policy. Fingerprinted Angular
assets use one-year immutable caching; HTML must revalidate and `app-config.json` uses
`no-store`. Both nginx and the Worker mark errors `no-store`; the Worker's
`cacheTtlByStatus` also prevents Cloudflare from storing upstream 4xx/5xx responses.

### WAF coverage

The Free plan's Cloudflare Free Managed Ruleset and HTTP DDoS protection are automatically
active for the zone, including the Worker's custom domain. The dashboard under
**Security → Settings** shows these protections as **Always active**. There is no paid
ruleset or Terraform enablement resource needed for this baseline. Keep these
Cloudflare-managed defaults in place; do not add a zone-wide skip rule. The broader
Cloudflare Managed Ruleset and OWASP ruleset require a paid plan. See
[WAF availability](https://developers.cloudflare.com/waf/managed-rules/) and
[Free plan defaults](https://developers.cloudflare.com/waf/get-started/).

This WAF protects requests arriving at `specsync.tubadev.com`. The direct Cloud Run web
origin and the gateway's public `run.app` URL do not pass through Cloudflare. The gateway
still enforces its own authentication and origin checks. Extending Cloudflare
protection to the API requires routing the gateway through Cloudflare as a separate change.

### Runtime configuration and credentials

The browser continues calling the gateway at its public `run.app` URL. The same `domain`
variable configures the gateway's `FRONTEND_ORIGIN`, Identity Platform authorized domains,
and the Identity API key's allowed referrers. This keeps Google login and gateway CORS
aligned. The gateway OAuth callback and `IDENTITY_AUTH_DOMAIN` do not move.

The hostname default lives in [`environments/dev/variables.tf`](environments/dev/variables.tf).
CI uses that default; it no longer reads the `APP_DOMAIN` GitHub variable. For a local
override use `TF_VAR_domain` or `terraform.tfvars`. Setting `domain = ""` removes the Worker
and custom domain and restores the direct frontend origin. The `web_origin_url` output
always exposes the underlying Cloud Run service URL; `app_url` is the browser URL.

Create a dedicated Cloudflare API token with **Account → Workers Scripts → Edit** for
the account in `cloudflare.tf`.
Cloudflare custom domains manage their DNS and certificate through the Workers API;
do not use the global API key or grant unrelated permissions. Store the token
as `CLOUDFLARE_API_TOKEN` in GCP Secret Manager in `fiap-challenge-ford`. The plan and deploy
workflows load it with the existing federated deployer identity and pass it only to
Terraform. No token value is committed, passed to the Worker, or read into Terraform state.

For local operations, alongside the GCP and Aura environment variables below:

```bash
export CLOUDFLARE_API_TOKEN="$(gcloud secrets versions access latest --secret=CLOUDFLARE_API_TOKEN --project="$TF_VAR_project_id")"
npm exec -- nx run infra:plan -c dev
npm exec -- nx run infra:apply -c dev
unset CLOUDFLARE_API_TOKEN
```

Wait for Cloudflare to finish certificate issuance, then verify the homepage, an Angular
deep link, Google login and an authenticated gateway call. The Workers Free plan allows
100,000 requests per day across the account; each proxied asset request counts toward that
limit. Existing Cloud Run usage charges still apply. See [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
and [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## Neo4j AuraDB

The dev root adopts existing instance `6b4eeb6d` (`My instance`) using a declarative
`import` block in [`environments/dev/aura.tf`](environments/dev/aura.tf). It belongs to
Aura project `5fb8597f-1eec-4da7-b44e-88fc721d8736` and runs on GCP in `us-central1`,
with the `professional-db` tier, 2 GB memory and 4 GB storage. This region is independent
of Cloud Run's `southamerica-east1`. The module has `prevent_destroy = true`; a change
requiring replacement must fail instead of deleting the populated database. Keep the
resource block in configuration: removing it also removes that lifecycle protection.

Provider 1.1.0's [instance read implementation](https://github.com/neo4j-labs/terraform-provider-neo4jaura/blob/v1.1.0/internal/resource/instance.go)
does not populate `project_id` or its creation-version selector when importing. A normal
import therefore incorrectly plans replacement, including when those fields are ignored.
Before the first plan against an existing instance, run the one-time adoption target:

```bash
# With the environment variables below already loaded:
npm exec -- nx run infra:aura-import -c dev
```

This verifies the instance's Aura project through the management API, backs up Terraform
state to a private temporary directory, imports the instance, and restores only the two
missing state fields. It advances the serial once, retains lineage and uses Terraform's
locked state push with stale-state protection. It never changes database contents. It refuses conflicting
metadata and is safe to rerun. Backups contain secrets from other Terraform modules;
keep them private and remove them after verification. Normal plans retain change detection
for every configured field; destruction protection stays enabled. The helper is restricted
to provider 1.1.0 and should be revisited when upgrading. The dev state has already been
adopted; CI only needs normal plan/apply operations. The provider still does not refresh
those two metadata fields from Aura, so check Aura directly before a project or engine
version migration.

The pinned [Neo4j Labs provider](https://neo4j.com/labs/neo4j-aura-terraform-provider/)
uses **Aura API credentials**, which differ from database credentials:

| Secret in `fiap-challenge-ford`                 | Consumer                 | Purpose                                                                    |
| ----------------------------------------------- | ------------------------ | -------------------------------------------------------------------------- |
| `AURA_CLIENT_ID`, `AURA_CLIENT_SECRET`          | Terraform runner         | Manage the Aura instance through its API                                   |
| `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` | Mastra Cloud Run service | Connect to the graph database                                              |
| `OPENROUTER_API_KEY`                            | Mastra Cloud Run service | Every routed model call (chat, vision, identification, extraction, titles) |

The `specsync-terraform` API credential was created in Aura Account settings → Client
credentials and stored in Secret Manager. CI uses its existing federated deployer identity
to fetch the two management secrets, masks them, and passes them only to the Terraform
step. The deployer already has Secret Manager admin access. For local operations, with
GCP ADC configured, load the same secrets into the environment without printing them:

```bash
export TF_VAR_project_id=fiap-challenge-ford
export TF_VAR_github_repository=IamP5/spec-sync
export USER_PROJECT_OVERRIDE=true
export GOOGLE_BILLING_PROJECT="$TF_VAR_project_id"
export AURA_CLIENT_ID="$(gcloud secrets versions access latest --secret=AURA_CLIENT_ID --project="$TF_VAR_project_id")"
export AURA_CLIENT_SECRET="$(gcloud secrets versions access latest --secret=AURA_CLIENT_SECRET --project="$TF_VAR_project_id")"
npm exec -- nx run infra:plan -c dev
# Review the plan before applying. Keep shell tracing disabled when loading secrets.
npm exec -- nx run infra:apply -c dev
unset AURA_CLIENT_ID AURA_CLIENT_SECRET
```

Terraform reads only secret metadata, grants the AI service account access to those
secrets (`OPENROUTER_API_KEY` included, see `openrouter.tf`), and injects their latest versions
through Cloud Run secret references.
`NEO4J_DATABASE` is `neo4j`. The API and web services receive no Neo4j credentials, and
Mastra receives no Aura management credentials. Existing database secret versions are
owned outside Terraform; importing an instance cannot recover its database password.
Secret payloads are never read into this module's state. A newly created Aura instance's
provider-generated password would enter Terraform state, so protect access to the state
bucket. Rotate Aura API credentials by updating the two Secret Manager versions together;
revoke the old credential only after a successful plan with the replacement.

AuraDB billing and availability are managed by Aura. The Cloud SQL start/stop schedule
does not pause AuraDB, and moving the graph's GCP region requires a separate data migration.

## Adding an environment

1. Copy `environments/dev` to `environments/prod`; change `prefix` in `backend.tf`, `env` in
   `locals.tf`, and the sizing/protection values in `main.tf` (tier, backups,
   `deletion_protection`, instance counts). Replace the Aura project and instance sizing
   in `aura.tf`; remove its dev import block when creating a new instance, or set the ID
   of the existing instance for that environment. Provision that environment's database
   secrets and management credentials before planning.
2. Add a `prod` configuration next to `dev` on the `initialize`, `plan`, `apply`, `destroy` and
   `output` targets in [`project.json`](project.json). If adopting an existing Aura instance,
   also configure `aura-import` with that environment's instance ID and Aura project UUID.
3. Point the workflows at it (`--configuration=prod`, `DEPLOY_ENV`, the GitHub `environment`),
   or add a second job if both environments should deploy.

`validate` and `fmt-check` pick up new environments automatically.

## CI/CD flow

Both workflows start with the reusable [`affected.yml`](../.github/workflows/affected.yml) job,
which asks Nx which projects changed (`nx show projects --affected`) and exposes `api`, `web`,
`ai`, `infra` flags plus the base/head SHAs. Everything downstream is gated on those flags, so a
docs-only change installs nothing and deploys nothing.

- **Pull requests** (`ci.yml`): `checks` runs `nx affected` for `build,lint,test` plus
  `fmt-check`/`validate` on `infra`; Java and Terraform are only installed when `api` or
  `infra` changed. `terraform-plan` runs only when `infra` changed and the GitHub variables
  exist, and shows the read-only plan in the PR.
- **Push to `main`** (`deploy.yml`): `infra` applies Terraform only when `infra/` changed;
  `apps` then runs `nx affected -t deploy` for `api`, `web` and/or `ai`; images are built inside
  Docker (multi-stage, layers cached in Artifact Registry under `:buildcache`), so the runner
  needs no Java or Gradle. The base commit is the last
  successful Deploy run, so a failed deploy is retried on the next push. "Run workflow" with
  `all=true` deploys every project.

What counts as "changed" for a deploy:

- files inside the project (including `apps/api/Dockerfile`, `apps/web/nginx/`,
  `apps/ai/Dockerfile`),
- any library it depends on (`ui` for `web`),
- the deploy scripts in `tools/deploy`: the `deploy` target in `nx.json` declares them as an
  input, and Nx uses target inputs when computing affected projects,
- files that belong to no project (`nx.json`, `package.json`, root `.dockerignore`): Nx treats
  those as affecting every project.

Terraform owns the Cloud Run services but ignores their `image`, so app deploys and infra
changes never fight each other.

## Notes and caveats

- **Dev database schedule**: Cloud Scheduler starts `specsync-dev-pg` at 08:00 and stops it at
  23:00 (America/Sao_Paulo) by patching its activation policy, so the instance is billed only
  ~15 h/day. Override manually with `nx run infra:db-start -c dev` / `db-stop` (needs
  `GCP_PROJECT_ID` and a gcloud login), or run a job on demand:
  `gcloud scheduler jobs run specsync-dev-pg-start --location southamerica-east1`. Starting
  takes 1-2 minutes; the API cannot boot while the database is stopped, so Cloud Run will
  report startup failures in that window.

- **HTTP/2 to the web container**: the `web` service port is named `h2c`, so Cloud Run
  talks cleartext HTTP/2 to nginx (which still accepts HTTP/1.1 too). The placeholder image
  used on first creation does not speak h2c, so the service only answers once CI has
  deployed the real image. Browsers get HTTP/2 + HTTP/3 from Cloud Run's front end
  regardless of this setting.

- The SPA is served by nginx on Cloud Run instead of GCS + Cloud CDN. That avoids the flat
  cost of a global load balancer and gives real 200 responses for deep links, at the price of
  no CDN and a short cold start after idle periods.
- Web and gateway are public services. API and AI require internal ingress and
  service-specific invoker grants. Existing curator authorization stays in Spring;
  the gateway requires a verified Identity Platform ID token for browser access. See the
  [gateway deployment guide](../apps/gateway/README.md) before the first rollout.
- `bootstrap/` keeps its state locally (`terraform.tfstate` is git-ignored). Losing it only
  means importing one bucket again; it is deliberately not stored in the bucket it creates.
- `@nx-extend/terraform` 10.4.1 passes `planFile`, `varFile` and `fmt --check` as a single
  argv string, which Terraform rejects. Those options are intentionally not used here:
  variables are `TF_VAR_*`/tfvars, and `fmt-check`/`validate` are plain commands.
- Workload Identity pools are soft-deleted for 30 days; if you destroy and recreate an
  environment, change `pool_id` in that environment's `main.tf`.
- Turn on `deletion_protection` and `backups_enabled` in `main.tf` for any environment that
  holds real data.
