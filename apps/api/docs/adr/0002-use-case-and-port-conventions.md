# ADR-0002: Use-case and port conventions

- Status: accepted
- Date: 2026-09-04

## Context

Layers (ADR-0001) say where code may live but not what a building block looks
like. Agents produce consistent code only when the shape of a use case, a
port, an adapter and a controller is fixed and checkable.

## Decision

Building blocks are identified by class-name suffixes and packages, all
enforced by `ArchitectureTest`:

| Building block | Shape                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Identifier     | record `<Aggregate>Id implements Identifier<T>` next to the aggregate                                                                    |
| Aggregate root | `extends AggregateRoot<ID>`, private constructor, factories `newX(...)` / `with(...)`                                                    |
| Domain event   | sealed `<Aggregate>Event` + past-tense records in `domain.<aggregate>.events`                                                            |
| Outbound port  | interface `*Gateway` in `domain.<aggregate>` (`*Repository` reserved for Spring Data)                                                    |
| Use case       | abstract verb-first class extending `UseCase`/`NullaryUseCase`/`UnitUseCase`, nested `Input` record and `Output` interface               |
| Implementation | `Default<UseCase>` in `application.<aggregate>.impl`, `@Service`, constructor injection                                                  |
| Adapter        | `<Aggregate><Technology>Gateway` or `<Vendor>Client` in `infrastructure.gateway.<aggregate>`, implements one domain gateway              |
| Persistence    | `<Aggregate>JpaEntity` and `<Aggregate>JpaRepository` in `...gateway.<aggregate>.persistence`, never referenced outside `infrastructure` |
| HTTP contract  | interface `<Aggregate>Api` in `web.api` owning mappings and OpenAPI annotations                                                          |
| Controller     | `<Aggregate>Controller implements <Aggregate>Api`, `@RestController`, depends on use cases only                                          |
| DTOs           | records `<Verb><Aggregate>Request` / `<Aggregate>Response` with `static from(Output)`                                                    |

Use-case outputs are interfaces rather than records so the web layer can
present them without an intermediate mapper: controllers call
`useCase.execute(input, GreetingResponse::from)` through the `Presenter`
abstraction.

Ports are named `Gateway` (not `Port` or `Repository`) to stay consistent
with the team's other services and to keep `Repository` unambiguous for
Spring Data.

## Consequences

- Renaming a class across suffixes re-classifies it and must be verified
  against these rules; it is not a cosmetic change.
- A controller that needs data must go through a use case, even for a
  one-line query. This keeps the HTTP layer thin and the use case testable
  with plain JUnit fakes.
- Suffixes describe intent; they do not prove implementation. ArchUnit is one
  line of defence alongside the architecture document and human review.
