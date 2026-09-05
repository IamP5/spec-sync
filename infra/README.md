# infra

Terraform for the Google Cloud environments of SpecSync, managed through Nx with
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
│   ├── cloud-sql-schedule/ # Cloud Scheduler jobs that start/stop the instance (dev cost control)
│   ├── pubsub/           # topic + subscriptions
│   ├── storage-bucket/
│   ├── cloud-run-service/# generic Cloud Run v2 service (used for api and web)
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
  users ──► Cloud Run "web" (nginx: Angular SPA, proxies /api, /v3/api-docs, /swagger-ui and /ai)
                 │
                 ├──► Cloud Run "api" (Spring Boot)
                 │        ├──► Cloud SQL Postgres 17 (private IP on the env VPC, reached via Direct VPC egress + Auth connector)
                 │        ├──► Pub/Sub topic + subscription
                 │        ├──► GCS files bucket
                 │        └──► Vertex AI (Gemini, via service account)
                 │
                 └──► Cloud Run "ai" (Mastra, Node)
                          └──► Vertex AI (Gemini, via service account; location = var.vertex_location)
  GitHub Actions ──► Workload Identity Federation ──► deployer service account (no keys)
```

The browser only talks to the `web` service, which proxies API paths to the `api` service
and `/ai/*` (prefix stripped, Server-Sent Events unbuffered) to the `ai` service. SPA, API
and AI therefore share one origin: the `/api` and `/ai` proxies used by `nx serve web` behave
the same in the cloud and there is no CORS configuration. No load balancer; idle cost is
Cloud SQL only. The `ai` service is stateless (no database); Gemini is not served from every
region, so its Vertex location is a separate variable (`vertex_location`, default `global`,
which is the only location serving Gemini 3.x; regional endpoints stop at the 2.5 family).

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
| `nx run ai:deploy`               | multi-stage Docker build (Mastra bundle + Node), push, `gcloud run deploy` |

`-c <env>` selects the environment (the Nx configuration sets the Terraform working directory).
Variables come from `TF_VAR_*` environment variables or a git-ignored
`environments/<env>/terraform.tfvars` (see `terraform.tfvars.example`). Deploy scripts read
`GCP_PROJECT_ID`, `GCP_REGION` and `DEPLOY_ENV`.

## First-time setup

1. Create a GCP project with billing enabled and `gcloud auth application-default login` as an
   owner.
2. Pick a globally unique state bucket name. Set it in
   [`bootstrap/variables.tf`](bootstrap/variables.tf) and in every
   `environments/<env>/backend.tf` (default `specsync-tfstate`).
3. Bootstrap the state bucket, then apply the environment:

   ```bash
   export TF_VAR_project_id=<gcp-project-id>
   export TF_VAR_github_repository=<owner>/<repo>
   npm exec -- nx run infra:bootstrap-apply
   npm exec -- nx run infra:apply -c dev
   ```

4. Copy the `github_actions` output (`nx run infra:output -c dev`) into the repository's
   Actions **variables**: `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WORKLOAD_IDENTITY_PROVIDER`,
   `GCP_DEPLOYER_SERVICE_ACCOUNT`, `APP_DOMAIN`. No secrets are needed.
5. If you set a domain, create the records listed in the `domain_dns_records` output. Cloud Run
   domain mappings only exist in a few regions (see
   [`modules/cloud-run-service/main.tf`](modules/cloud-run-service/main.tf)); elsewhere put
   Cloudflare or similar in front of the `app_url`.
6. Push to `main`. The first `Deploy` run replaces the placeholder images of the three Cloud
   Run services. Use "Run workflow" with `all=true` if the first run picks up nothing.

## Adding an environment

1. Copy `environments/dev` to `environments/prod`; change `prefix` in `backend.tf`, `env` in
   `locals.tf`, and the sizing/protection values in `main.tf` (tier, backups,
   `deletion_protection`, instance counts).
2. Add a `prod` configuration next to `dev` on the `initialize`, `plan`, `apply`, `destroy` and
   `output` targets in [`project.json`](project.json).
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
- The `api` and `ai` services must accept public ingress because `web` reaches them over
  their `run.app` URLs. Spring Security remains the authentication layer for API requests;
  the `ai` service has no authentication of its own yet (Mastra middleware checking a header
  that only nginx adds is the intended next step if that becomes a concern).
- `bootstrap/` keeps its state locally (`terraform.tfstate` is git-ignored). Losing it only
  means importing one bucket again; it is deliberately not stored in the bucket it creates.
- `@nx-extend/terraform` 10.4.1 passes `planFile`, `varFile` and `fmt --check` as a single
  argv string, which Terraform rejects. Those options are intentionally not used here:
  variables are `TF_VAR_*`/tfvars, and `fmt-check`/`validate` are plain commands.
- Workload Identity pools are soft-deleted for 30 days; if you destroy and recreate an
  environment, change `pool_id` in that environment's `main.tf`.
- Turn on `deletion_protection` and `backups_enabled` in `main.tf` for any environment that
  holds real data.
