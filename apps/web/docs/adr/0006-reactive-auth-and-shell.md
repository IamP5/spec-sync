# ADR-0006: Reactive authentication and application shell

Status: Accepted

## Context

The public Angular app calls the public gateway, which authenticates Google Cloud
Identity Platform users and invokes private API/AI services. Reloading the browser
after login/logout hid state-lifecycle problems and discarded guest drafts. The
account menu also mixed auth, user preferences and chat history ownership.

## Decision

Keep auth and user as separate domains. Auth owns credentials, verification and
login/logout; user owns profile, role data and browser preferences. Top-level shell
composes domain features into the responsive layout, account menu and settings.
Shared contains only technical utilities that genuinely have multiple consumers.

Use the modular Firebase SDK with RxFire auth observables, Angular signals and NgRx
Signal Store events. At evaluation, this app uses Angular 22; AngularFire's published
20 release and 21 prerelease do not declare Angular 22 support. RxFire 6.2 supports
our Firebase 12/RxJS 7 dependencies without another Angular compatibility layer.
AngularFire is therefore unnecessary for the current authentication-only scope.

Sources: [AngularFire](https://github.com/angular/angularfire),
[RxFire authentication](https://github.com/FirebaseExtended/rxfire/tree/main/auth),
[NgRx SignalStore events](https://ngrx.io/guide/signals/signal-store/events).

The auth lifecycle has a credential-free current snapshot for lazy consumers and
typed events for synchronous domain-owned resets. Each identity transition receives
a new generation. Same-identity token refresh keeps the generation, preserving the
conversation. HTTP requests are cancelled and asynchronous completions are checked
against the captured scope before they can update another account's state.

Public chat accepts a draft. Explicit Send opens auth-owned sign-in content and
resumes exactly once after verification/runtime preparation. Sidebar sign-in carries
the draft forward without sending. Cancelling sign-in keeps the text. No login or
logout path reloads the document.

## Consequences

Session-bound state must handle both initial snapshots and later invalidations.
Tests cover restoration, token refresh, login cancellation, account switching,
request cancellation and draft handoff. Sheriff and tsarch enforce shell/domain
ownership and public entries. Firebase objects and tokens remain outside stores,
events and devtools; backend authorization continues to enforce roles.

This change does not alter Cloud Run ingress, IAM or gateway deployment topology.
