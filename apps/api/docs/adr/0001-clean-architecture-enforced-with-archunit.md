# ADR-0001: Clean architecture enforced with ArchUnit

- Status: accepted
- Date: 2026-09-04

## Context

`apps/api` starts as a single greeting endpoint, but it is developed with AI
coding agents that generate a lot of code quickly. Without machine-checked
boundaries, an agent places code wherever it compiles: JPA entities leak into
controllers, use cases call Spring Web, and the architecture erodes silently.

Two earlier services of the same team already follow the clean architecture
of the "Full Cycle" reference (`domain`, `application`, `infrastructure`) and
one of them polices it with ArchUnit. Reusing that shape keeps the conventions
familiar and lets the rules be copied instead of invented.

## Decision

The API is organised into four rings under `com.fiap.ford.specsync`:

- `domain`: aggregates, value objects, identifiers, events and the outbound
  ports (`*Gateway`). Framework-free.
- `application`: use cases (`UseCase`, `NullaryUseCase`, `UnitUseCase`) with
  `Default*` implementations that orchestrate the domain through the ports.
- `infrastructure`: outbound adapters (persistence, external services,
  messaging) and Spring configuration.
- `web`: the inbound HTTP adapter (`*Api` contracts, `*Controller`, DTOs).

Dependencies only point inwards (`web`/`infrastructure` → `application` →
`domain`). [ArchUnit](https://www.archunit.org) checks the layer rule and the
naming conventions in `ArchitectureTest` (JUnit tag `architecture`), exposed
as the Gradle task `archTest` so the hooks can run it in seconds
(`nx run api:archTest`). The full `test` task runs it as well.

A single Gradle module is kept instead of the three-module split of the
reference: Nx already isolates the API from the other apps, and ArchUnit
enforces the same dependency direction inside one module.

## Consequences

- ArchUnit failures are architecture feedback, not test noise. Fix the code,
  not the rule. Rule changes require an explicit user request.
- Every rule carries a `because(...)` so the failure message explains the
  convention; the rules are the executable version of
  `apps/api/docs/architecture-boundaries.md`.
- New building blocks (a second persistence technology, messaging consumers)
  must be added to the rule set together with the code.
