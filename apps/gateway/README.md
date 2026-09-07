# SpecSync gateway

Hono on Node.js is the public entry point for the application. It authenticates
Google users through Google Cloud Identity Platform and proxies the existing
frontend contracts without buffering AI responses.

```text
Browser ── HTTPS ── gateway ── Cloud Run IAM + VPC ── web (static Angular)
                       ├───── Cloud Run IAM + VPC ── api (Spring Boot)
                       └───── Cloud Run IAM + VPC ── ai (Mastra)
                                                     ↕ private service calls
                                                    api
```

Only `gateway` grants `allUsers` the Cloud Run invoker role. API, AI and web use
`allow_unauthenticated = false` **and** `INGRESS_TRAFFIC_INTERNAL_ONLY`.
Direct VPC egress, Private Google Access and private `run.app` DNS make gateway,
API and AI calls internal without forcing external AI traffic through Cloud NAT.
The API and AI identities retain invoker access to each other for catalog and
worker requests. The static web identity has no backend invocation permissions.

## Authentication and routes

- `GET /auth/login`: Google authorization-code flow, browser-bound random state
  and PKCE; credentials are exchanged by the gateway, never stored in Angular.
- `GET /auth/callback`: exchange the Google ID token using Identity Platform's
  `accounts:signInWithIdp`; verify its issuer, project audience, signature,
  revocation, Google provider, verified email and recent authentication via the
  Admin SDK. Create a 24-hour Identity Platform session cookie.
- `GET /auth/me`: `{ uid, email, roles }` from the verified session.
- `POST /auth/logout`: clear the session cookie. The confirmation form is at
  `GET /auth/logout`. Logout clears this browser; operator revocation invalidates
  every session for a user.
- `/api/*`: Spring Boot, retaining the path and the existing `X-Ingestion-Key`
  curator credential. Google login does not grant curator privileges.
- `/ai/copilotkit` (GET/POST), `/ai/chat/models` (GET): Mastra with `/ai` stripped.
  Studio, workflow APIs and `/internal/ingestion/*` are never browser routes.
- Other GET/HEAD requests: private web container; HTML navigation without a valid
  session redirects to Google login. Unauthenticated data requests return 401.
- `GET /healthz`: public liveness endpoint.

Session cookies are HTTP-only, Secure, SameSite=Lax, host-only and use the
`__Host-` prefix on HTTPS. Every authenticated request checks revocation/disabled
users. Mutation requests require an exact `Origin` match to `PUBLIC_ORIGIN`;
there is no cross-origin browser API. Responses are private/no-store. On expiry,
reload the page to sign in again. Authentication errors never include tokens.

Forwarding uses Hono's built-in [`proxy()` helper](https://hono.dev/docs/helpers/proxy)
for request/response streaming and transport-header handling. A small gateway
policy wrapper uses a fixed upstream allowlist, strips browser cookies and identity,
forwarding and Cloud Run headers, refuses upstream redirects, forwards aborts,
and streams bodies. `X-Serverless-Authorization` contains an ADC-derived Google
ID token whose audience is the destination Cloud Run origin. That token proves
workload identity, independently of the end user or curator credential.

## Roles and the downstream contract

Identity Platform custom claims contain `roles: string[]`. Role names are
lowercase identifiers (`reviewer`, `admin`, `catalog:read`, etc.). No role is
granted by default, by email domain, or from browser input. Current routes require
sign-in; business role policies are deliberately left for the services.

The gateway emits these headers to API and AI after session verification:

- `X-SpecSync-Session`: the signed Identity Platform session JWT, for downstream
  verification and future authorization. Verify with `verifySessionCookie(token,
true)` (Firebase Admin SDK) or the equivalent session-cookie verification rules
  before using its `roles` claim. This is a session JWT, not an OAuth access token
  or a Cloud Run invocation token; `verifyIdToken` is not the right verifier.
- `X-SpecSync-User`: base64url-encoded UTF-8 JSON `{ uid, email, roles }` for request
  context. This normalized header is not independently signed; do not use it as
  an authorization proof. Other authorized workloads can also reach the services.

The signed user session is not sent to the static web service. Background
AI-to-API and API-to-AI operations currently carry workload identity only; they
must not invent a user or inherit roles from model input. Future user-scoped tool
authorization must explicitly propagate and verify the signed session.

An operator with Firebase Authentication admin permissions can assign roles using
ADC; the gateway's runtime identity cannot change users or claims:

```sh
gcloud auth application-default login
node apps/gateway/ops/set-user-roles.mjs PROJECT_ID IDENTITY_PLATFORM_UID reviewer
# Omit all roles to remove them.
```

The script preserves unrelated claims and revokes existing sessions so role
removal takes effect without waiting for cookie expiry. The user signs in again.
Identity Platform custom claims have a 1,000-byte limit; keep role lists small.

## Local development

Configure the Google Web OAuth client and Identity Platform provider as below,
including `http://localhost:3000/auth/callback` as a redirect URI. Then:

```sh
cp apps/gateway/.env.example apps/gateway/.env
# Fill project, client ID, client secret and the Identity Platform API key.
gcloud auth application-default login
npm exec -- nx run api:bootRun
npm exec -- nx dev ai
npm exec -- nx serve web
npm exec -- nx serve gateway
```

Run the services in separate terminals and open **http://localhost:3000**.
Angular serves assets on 4200; its `/api`, `/ai`, `/auth` proxy points to the gateway.
The gateway remains responsible for sign-in locally. Plain HTTP and unsigned
workload calls are allowed only for loopback development; production forces
HTTPS and Cloud Run IAM and rejects the Firebase auth emulator. Angular HMR's
WebSocket is not proxied; reload the gateway page after frontend edits.

## Provisioning and rollout

This change contains deployment configuration; it does not apply Terraform or
publish images automatically from a local coding session.

### Configured dev project

The console setup for `fiap-challenge-ford` was completed on 2026-09-07:

- OAuth application: `SpecSync`; web client: `SpecSync gateway (dev)`.
- Client ID: `492443755274-eq1mq82jfcc66ark4b2u55c1q9lekq9v.apps.googleusercontent.com`.
  The same value is stored in the repository variable `GOOGLE_OAUTH_CLIENT_ID`.
- Secret Manager: `GOOGLE_OAUTH_CLIENT_SECRET`, enabled version 1. The secret
  payload is not stored in the repository.
- Identity Platform is enabled with the Google provider. The gateway host and
  `localhost` are authorized, and both `/auth/callback` URLs are registered.
- OAuth remains in testing mode. Public publishing still requires completion of
  the branding requirements shown by Google Auth Platform.

The gateway container and the private-service migration still require the rollout
below. The import blocks adopt the console-created Identity Platform resources
when Terraform is next applied; they have not yet imported live state.

### Rollout steps

1. In the same GCP project, configure the Google OAuth consent screen and create
   a **Web application** client. Add `PUBLIC_ORIGIN/auth/callback` as an authorized
   redirect URI. Without a custom domain the origin is
   `https://specsync-dev-gateway-PROJECT_NUMBER.REGION.run.app`. Add local callback
   URLs separately. Consent-screen audience/test-user restrictions still apply.
2. Store that client's secret in the existing Secret Manager secret named
   `GOOGLE_OAUTH_CLIENT_SECRET` (or set `google_oauth_secret_id`). Give the Terraform
   runner permission to read it. No service-account key files are needed.
3. Set Terraform `google_oauth_client_id` and GitHub repository variable
   `GOOGLE_OAUTH_CLIENT_ID`. Terraform enables Identity Platform, configures its
   Google provider and authorized domains, and creates an API key restricted to
   Identity Toolkit. The dev configuration includes import blocks for Identity
   Platform and its Google provider, configured through the console in
   `fiap-challenge-ford`. For a new project, complete that console setup first or
   remove the two import blocks so Terraform creates these resources.
   Terraform references the OAuth secret while configuring the provider; its
   sensitive value is consequently stored in Terraform state. Protect state access.
4. Existing deployers need the newly declared `iam.roleAdmin`,
   `identityplatform.admin`, and `serviceusage.apiKeysAdmin` permissions before the
   first CI apply (an administrator can apply the IAM update). The gateway itself
   receives only `firebaseauth.users.get` and `firebaseauth.users.createSession`,
   access to its OAuth secret and service-scoped invoker grants.
5. Review the Terraform plan and apply dev infrastructure. This removes existing
   public invoker bindings, adds internal ingress and moves any custom-domain
   mapping to the gateway. Build and deploy **gateway, web, api and ai together**
   using the Deploy workflow's `all=true` option. The first migration has an
   interruption between closing the old services and deploying the new images;
   schedule it accordingly. Ordinary subsequent deploys use Nx affected projects.
6. Validate in GCP: an external anonymous request to API/AI/web must fail; a
   browser navigation to the gateway must sign in with Google, render the SPA,
   fetch catalog/model data and stream chat. Validate API worker invocation and
   AI catalog retrieval. Assign/remove a test role, check `/auth/me`, and confirm
   that revoked sessions require a new sign-in. Direct default service URLs remain
   private even when the gateway has a custom domain.

`PUBLIC_ORIGIN` must match the browser origin exactly. The gateway uses the fixed
configured callback origin rather than trusting Host/X-Forwarded-Host headers.
No real OAuth credentials or end-to-end GCP calls are needed for the unit tests:

```sh
npm exec -- nx run-many -p gateway -t lint,typecheck,test,build
npm exec -- nx run infra:validate
```

References: [Identity Platform federated exchange](https://cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/signInWithIdp),
[session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies),
[custom claims](https://firebase.google.com/docs/auth/admin/custom-claims),
[Cloud Run service authentication](https://cloud.google.com/run/docs/authenticating/service-to-service),
[private Cloud Run networking](https://cloud.google.com/run/docs/securing/private-networking).
