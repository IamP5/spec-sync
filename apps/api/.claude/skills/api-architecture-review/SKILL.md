---
name: api-architecture-review
description: Reviewing or auditing Java code in apps/api against the clean architecture rules (layer direction, Gateway ports, Default* use cases, Api/Controller split, persistence confinement, error handling). Use for architecture reviews of changes under apps/api.
---

# Review API Architecture

Use this skill when reviewing Spring Boot code in `apps/api` for
architectural quality.

Before reviewing, read:

- `apps/api/docs/architecture-boundaries.md`
- `apps/api/AGENTS.md`
- `apps/api/src/test/java/com/fiap/ford/specsync/architecture/ArchitectureTest.java`
- the changed files and their imports

Treat `apps/api/docs/architecture-boundaries.md` as the source of truth.

Do not invent additional rules. If something is not covered by the document,
infer cautiously from the greeting slice and mark it as an inference.

## Process

1. Identify the affected aggregate and the layer of every changed file
   (`domain`, `application`, `infrastructure`, `web`).
2. Check the imports of each changed file against the layer table: nothing
   framework-related in `domain`, nothing from `infrastructure` or
   `application..impl` in `web`, JPA and Spring Data only inside
   `infrastructure`.
3. Check the building-block shape: `<Aggregate>Id` record, `*Gateway` port
   next to the aggregate, abstract verb-first use case with nested
   `Input`/`Output`, `Default*` in `impl` with `@Service`, adapter
   implementing one gateway, `*Api` interface plus `*Controller`,
   `*Request`/`*Response` records.
4. Check error handling: invariants in the domain via `AssertionConcern`,
   no `try/catch` of `DomainException` in controllers or use cases, no
   `ResponseStatusException` for business rules.
5. Check tests: pure JUnit with fakes for domain and use cases, a
   `*WebMvcTest` for every controller, `*IT` for adapters.
6. Report only concrete findings and recommend the smallest useful fix.

## Output

Provide:

- summary
- findings by severity
- affected files
- violated rule from `apps/api/docs/architecture-boundaries.md`
- concrete fix
- checks that should be run (`npx nx run api:archTest`,
  `npx nx run api:test`, or `npm run verify`)
