# SpecSync gateway

Hono on Node.js authenticates browser requests with Google Cloud Identity Platform.
Web and gateway are separate public Cloud Run services. Spring Boot and AI stay
internal and require Cloud Run IAM authentication. There is no load balancer.

```text
Browser → public web (Angular assets + login)
Browser → public gateway → private API / AI
                               API ↔ AI (workload identity)
```

## Authentication and roles

Angular uses the Firebase JavaScript SDK against Identity Platform's Google provider.
The SDK owns popup sign-in, session persistence and ID-token refresh. Browser sessions
use session storage and end when the tab closes. OAuth secrets remain in the Google
provider configuration and Secret Manager; the browser receives only public SDK config.

The browser sends `Authorization: Bearer <Identity Platform ID token>`. The gateway
uses Firebase Admin `verifyIdToken(token, true)` to check signature, expiry, audience,
issuer, revocation and disabled users, and requires a verified Google email. Google
access tokens and arbitrary user headers do not authenticate a request. There are no
cross-site session cookies and no custom OAuth callback/exchange implementation.

`GET /auth/session` returns only `{ uid }` for session verification.
`GET /user/me` returns `{ uid, email, displayName, photoUrl, roles }` from verified claims.
Roles are informational application data in Angular, never a UI permission check or
editable preference. Business authorization remains a future backend policy. New users
receive no implicit role. Operators can assign roles using ADC:

```sh
node apps/gateway/ops/set-user-roles.mjs PROJECT_ID UID reviewer
# Omitting roles clears them. Every change revokes tokens and requires a new login.
```

## Routing and transport

- Public `GET /health` returns `ok`; `/` redirects to the frontend.
- Authenticated `/api`, `/v3/api-docs` and `/swagger-ui` forward to Spring Boot.
- Only `/ai/copilotkit` GET/POST and `/ai/chat/models` GET forward to AI.
- Unknown routes, frontend assets, AI Studio and internal workers are not exposed.
- Hono's official `hono/proxy` helper handles forwarding with streaming and cancellation.
  The wrapper filters headers, forbids upstream redirects and prevents shared caching.
- Hono's official CORS middleware allows exactly `FRONTEND_ORIGIN`, including preflight
  and the headers needed for streaming and curator workflows. CORS is not authentication;
  even non-browser clients must supply valid tokens.
- The gateway adds an ADC Cloud Run ID token in `X-Serverless-Authorization` for the
  exact upstream audience. Browser cookies, bearer authorization and forged identity
  headers are removed. Existing `X-Ingestion-Key` curator credentials are preserved.
- `X-SpecSync-Token` carries the original signed Identity Platform token to API/AI;
  future user policies must verify it with `verifyIdToken`, including expected project.
  `X-SpecSync-User` is normalized base64url JSON for context, not an authorization proof.
- API and AI also use workload identity for their existing internal calls.

Angular uses a functional HTTP interceptor for gateway paths only. It gets a current
SDK token for each request and never attaches it to external URLs. CopilotKit owns a
separate streaming transport: chat connects the runtime only after verification and
refreshes credentials before each run. Session invalidation aborts active runs and
clears the runtime headers without reloading the page. Writes are not automatically retried.

## Auth and user domains

`apps/web/src/app/domains/auth` owns the SDK session, session store, login dialog
content and logout component. Public chat accepts guest drafts; sending requires
verified sign-in. Tokens remain outside application stores and devtools.

`apps/web/src/app/domains/user` owns profile, roles and preferences including theme.
The application shell composes its Google profile photo, preferences and auth's
logout component into the account menu. Chat consumes public user preferences;
private stores reset their own data on typed session lifecycle events. Browser
preferences and conversation history remain scoped to the signed-in UID, and
anonymous history is never assigned to an arbitrary Google account.
These local records do not synchronize between devices.

## Local development

```sh
cp apps/gateway/.env.example apps/gateway/.env.local
cp apps/web/public/app-config.example.json apps/web/public/app-config.json
# Fill in the public Identity Platform API key in app-config.json.
gcloud auth application-default login
npm exec -- nx serve gateway
npm exec -- nx serve web
```

Open `http://localhost:4200`; the browser calls gateway `http://localhost:3000` directly.
Add localhost to Identity Platform and the browser key's allowed referrers. The gateway
uses project ADC to verify users; production forbids the authentication emulator and
requires HTTPS and Cloud Run workload authentication.

## Cloud configuration

Terraform enables the Google provider, creates a browser API key restricted to Identity
Toolkit/Secure Token APIs and approved web origins, and supplies public SDK configuration
to web's `/app-config.json`. Runtime configuration keeps environment values out of the
Angular build. Do not put OAuth client secrets in this file.

The OAuth web client must authorize `https://PROJECT_ID.firebaseapp.com/__/auth/handler`
as a redirect URI. Identity Platform must authorize the public frontend hostname,
`PROJECT_ID.firebaseapp.com`, and localhost for development. The registered Google
client ID is the `GOOGLE_OAUTH_CLIENT_ID` repository variable; its secret is
`GOOGLE_OAUTH_CLIENT_SECRET` in Secret Manager.

Web and gateway grant `allUsers` invocation. API and AI use internal ingress, and
only the gateway and required workload service accounts can invoke them. Direct VPC
egress, Private Google Access and private `run.app` DNS allow those private calls.
The gateway service account can check users but cannot assign roles or access OAuth secrets.

The dev project is `fiap-challenge-ford`, region `southamerica-east1`. The new public
frontend is `https://specsync-dev-web-492443755274.southamerica-east1.run.app`;
the gateway is `https://specsync-dev-gateway-492443755274.southamerica-east1.run.app`.
The Google OAuth app remains in Testing mode with explicitly configured test users.

Before rollout, run `npm run verify`, Terraform format/validation/plan and build both
images. After rollout, verify the anonymous login page, Google profile/photo, sign-out,
AI streaming/catalog retrieval, gateway 401 without a token and private backend ingress.

## References

- [Identity Platform Google sign-in](https://docs.cloud.google.com/identity-platform/docs/web/google)
- [Verify ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Custom claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Hono proxy](https://hono.dev/docs/helpers/proxy)
- [Hono CORS](https://hono.dev/docs/middleware/builtin/cors)
