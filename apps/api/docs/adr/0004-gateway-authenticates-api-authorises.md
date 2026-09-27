# ADR-0004: The gateway authenticates, the API authorises

- Status: accepted
- Date: 2026-09-27

## Context

The browser already signs in with Google through Identity Platform, and the
gateway (`apps/gateway`) verifies every request's ID token before it forwards
anything. The API, however, did not use that identity. Curator endpoints were
protected by a shared secret (`X-Ingestion-Key`) that the curator typed into the
web UI. The gateway removed the `Authorization` header and passed an unverified
`x-specsync-user` header, and there was no notion of roles in the API. That
gave us three authentication mechanisms for people and no authorisation model.

## Decision

- **Authentication belongs to the gateway.** It verifies the Identity Platform
  ID token (signature, expiry, audience, issuer, revocation, disabled user,
  verified Google e-mail) and forwards the same token to the API as
  `Authorization: Bearer <JWT>`. Cloud Run IAM keeps using
  `X-Serverless-Authorization`, so the two headers never collide.
- **The API is an OAuth 2.0 resource server that only authorises.** Spring
  Security's `oauth2ResourceServer().jwt()` validates the forwarded JWT: RS256
  signature against Google's securetoken JWKS (fetched lazily and cached), issuer
  `https://securetoken.google.com/<project>`, audience `<project>`, `exp`/`nbf`
  with 60 s skew, and a non-blank `sub`. It then maps claims to authorities:
  `sub` is the principal, and `roles` becomes `ROLE_CURATOR`/`ROLE_ADMIN` on top
  of an implicit `ROLE_USER`. The API has no login endpoint, stores no
  passwords and issues no user tokens.
- **Roles live in Identity Platform custom claims**, assigned by operators with
  `apps/gateway/ops/set-user-roles.mjs`. The hierarchy
  `ADMIN > CURATOR > USER` is declared once (`SecurityConfiguration.roleHierarchy`).
- **Access rules are URL-based and live in `infrastructure.configuration`.**
  Public `GET` catalog reads and the API docs, `USER` for `/api/me`, `CURATOR`
  for `/api/ingestions/**` and `/api/ontology/**`, and authenticated for
  anything else. Controllers stay free of security code; they read the verified
  principal (`Principal`, `@AuthenticationPrincipal Jwt`) only to record who
  acted.
- **The shared curator key is retired.** The queue of curator imports stays
  shared (`Ingestion.CURATOR_WORKSPACE`), and each publication records the
  curator's uid as reviewer.
- **Machine-to-machine calls keep service credentials.** The AI service's
  credits and research calls use per-surface bearer keys; Cloud Scheduler uses a
  Google OIDC token. These callers act for the system rather than for a person,
  do not pass through the gateway, and outlive a one-hour user token (research
  runs take up to 20 minutes after the user's request).
- **401 and 403 are RFC 9457 problems** (`ProblemResponses`) with the RFC 6750
  `WWW-Authenticate: Bearer` challenge, which carries `error="invalid_token"`
  when a token was presented and refused.

## Alternatives considered

- _The gateway mints its own short-lived JWT for the API._ This would decouple
  the API from Identity Platform, but it needs key management in the gateway and
  would put a second token format in the system. The ID token is already a
  signed, expiring, audience-bound JWT that carries the roles.
- _Trust `x-specsync-user` behind Cloud Run IAM._ Rejected: anything with
  invoker rights on the API could impersonate any user or role.
- _Keep the curator key as a fallback._ Rejected: it is a second way to
  authenticate a person, it is shared between people, and it records no
  individual reviewer.

## Consequences

- A role change takes effect at the user's next sign-in; the ops script
  revokes refresh tokens to force it.
- Calling the API directly (Swagger UI, curl) needs a real Identity Platform ID
  token of the configured project; `apps/api/README.md` explains how to get one.
- Tests sign ID-token-shaped JWTs with a local key (`TestTokens`) and run them
  through the production validator, so expiry, forgery, wrong project and
  role rules are covered without network access.
