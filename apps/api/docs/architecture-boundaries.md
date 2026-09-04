# Architecture Rules

## Goal

This document defines the architecture rules for the Spring Boot API in
`apps/api`. Both agents and developers are required to adhere to these rules
whenever they modify application code.

The rules are enforced deterministically by **ArchUnit**
(`apps/api/src/test/java/com/fiap/ford/specsync/architecture/ArchitectureTest.java`,
runs as `nx run api:archTest` and as part of `nx run api:test`). Every rule
carries a `because(...)` that names the convention it protects.

Concise rules live here. The reasoning behind them lives in the linked ADRs
under `apps/api/docs/adr/`.

## Reference Implementation

Model new features after the greeting slice in terms of structure and style:

- aggregate: `apps/api/src/main/java/com/fiap/ford/specsync/domain/greeting/Greeting.java`
- outbound port: `.../domain/greeting/HashGateway.java`
- use case: `.../application/greeting/CreateGreeting.java`
- implementation: `.../application/greeting/impl/DefaultCreateGreeting.java`
- adapter: `.../infrastructure/gateway/greeting/UuidHashGateway.java`
- HTTP contract and controller: `.../web/api/GreetingApi.java`,
  `.../web/controllers/GreetingController.java`
- response DTO: `.../web/dto/response/GreetingResponse.java`

## Layers

_(derived from [ADR-0001](adr/0001-clean-architecture-enforced-with-archunit.md))_

```
com.fiap.ford.specsync
  Application.java                       # Spring Boot entry point (outside the layers)
  domain/                                # innermost ring, framework-free
    shared/                              # AggregateRoot, Entity, Identifier, ValueObject,
                                         # AssertionConcern, DomainEvent
    exceptions/                          # DomainException, NoStacktraceException
    validation/                          # Error(property, message)
    <aggregate>/                         # aggregate root, value objects, <Aggregate>Id,
                                         # <Aggregate>Gateway ports, events/
  application/                           # use cases
    UseCase, NullaryUseCase, UnitUseCase, Presenter
    <aggregate>/                         # abstract use cases with nested Input/Output
    <aggregate>/impl/                    # Default<UseCase> (@Service)
  infrastructure/                        # outbound adapters and Spring configuration
    configuration/                       # SecurityConfiguration, GlobalExceptionHandler, ...
    gateway/<aggregate>/                 # <Aggregate>JpaGateway, <Vendor>Client, ...
    gateway/<aggregate>/persistence/     # <Aggregate>JpaEntity, <Aggregate>JpaRepository
    messaging/                           # inbound consumers (Pub/Sub, streams)
  web/                                   # inbound HTTP adapter
    api/                                 # <Aggregate>Api interfaces (mappings + OpenAPI)
    controllers/                         # <Aggregate>Controller implements <Aggregate>Api
    dto/request/, dto/response/          # records <Verb><Aggregate>Request, <Aggregate>Response
```

Dependencies point inwards only:

| Layer            | May import                                                      | Must never import                     |
| ---------------- | --------------------------------------------------------------- | ------------------------------------- |
| `domain`         | `java.*`, `domain`                                              | any framework, any other layer        |
| `application`    | `domain`; Spring `@Service`/`@Transactional` on `Default*` only | `infrastructure`, `web`               |
| `infrastructure` | `domain`, `application`, Spring, JPA, Google Cloud, Spring AI   | `web`                                 |
| `web`            | `domain`, `application` abstractions, Spring Web, springdoc     | `infrastructure`, `application..impl` |

- JPA, Spring Data, Spring transactions, Google Cloud, Spring AI and Spring
  Cloud classes may only be referenced from `infrastructure`.
- `@Component` and `@Configuration` are adapter concerns (`infrastructure`,
  `web`). `@Service` belongs exclusively on `Default*` use-case
  implementations. `@Repository` belongs exclusively on gateway adapters.
- Constructor injection only. `@Autowired` on fields is forbidden.

## Domain

_(derived from [ADR-0002](adr/0002-use-case-and-port-conventions.md))_

- Packages are singular and named after the aggregate (`domain.greeting`).
- Aggregate roots extend `AggregateRoot<ID>`; entities extend `Entity<ID>`;
  value objects are records implementing `ValueObject`.
- Identifiers are records named `<Aggregate>Id` implementing `Identifier<T>`.
- Aggregates are created through static factories: `newX(...)` for new
  instances (may register events) and `with(...)` to rehydrate from
  persistence (never registers events). Constructors are private.
- Invariants are asserted by hand through `AssertionConcern`; every violation
  raises a `DomainException` with an `Error(property, message)`. No Lombok, no
  Bean Validation in the domain.
- Outbound ports are interfaces named `<Aggregate>Gateway` (or
  `<Concern>Gateway`, e.g. `HashGateway`) and live next to their aggregate.
  `*Repository` is reserved for Spring Data.
- Domain events live in `domain.<aggregate>.events`: a sealed
  `<Aggregate>Event` interface and immutable past-tense records
  (`GreetingCreated`) implementing it.

## Application

_(derived from [ADR-0002](adr/0002-use-case-and-port-conventions.md))_

- A use case is an abstract class named verb-first (`CreateGreeting`,
  `GetGreetingById`, `ListGreetings`) that extends `UseCase<IN, OUT>`,
  `NullaryUseCase<OUT>` or `UnitUseCase<IN>`.
- Inputs are nested records (`Input`); outputs are nested interfaces
  (`Output`) so a response DTO or a presenter can implement or map them.
- The implementation is `Default<UseCase>` in the `impl` sub-package,
  annotated `@Service`, with constructor-injected ports. Top-level classes in
  `impl` packages are always `Default*`.
- Use cases depend on gateways (ports), never on adapters, controllers or
  Spring Web types. They are event-agnostic: aggregates register events,
  gateways persist them.
- `@Transactional` is allowed on `Default*` methods and on gateway methods
  only.

## Infrastructure

_(derived from [ADR-0002](adr/0002-use-case-and-port-conventions.md))_

- An adapter implements exactly one domain gateway and is named
  `<Aggregate><Technology>Gateway` (`GreetingJpaGateway`, `UuidHashGateway`)
  or `<Vendor>Client` for HTTP integrations. Persistence adapters carry
  `@Repository`; other adapters carry `@Component`.
- JPA entities are `<Aggregate>JpaEntity` (`@Entity`) and Spring Data
  interfaces are `<Aggregate>JpaRepository`, both confined to
  `infrastructure.gateway.<aggregate>.persistence`. Nothing outside
  `infrastructure` may reference them; the gateway maps them to domain
  objects at the edge.
- Spring configuration (`*Configuration`, `*Properties`, the
  `GlobalExceptionHandler`) lives in `infrastructure.configuration`.
- Inbound message consumers live in `infrastructure.messaging` and call
  use-case abstractions, exactly like controllers do.

## Web

_(derived from [ADR-0002](adr/0002-use-case-and-port-conventions.md) and
[ADR-0003](adr/0003-error-handling-at-the-edge.md))_

- The HTTP contract is an interface `<Aggregate>Api` in `web.api` that owns
  `@RequestMapping`, the method mappings and the springdoc annotations.
- `<Aggregate>Controller` in `web.controllers` is a `@RestController` that
  implements its `*Api`, depends on use-case abstractions only and presents
  through `useCase.execute(input, <Response>::from)`.
- Controllers never reference gateways, `Default*` classes or anything under
  `infrastructure`.
- Inbound DTOs are records `<Verb><Aggregate>Request` in `web.dto.request`
  carrying Bean Validation annotations; outbound DTOs are records
  `<Aggregate>Response` in `web.dto.response` with a static `from(Output)`.
- Controllers never catch `DomainException`. The `GlobalExceptionHandler`
  maps it to HTTP 422 as an RFC 9457 problem with the `errors` list.

## Changing the Architecture Rules

- Modify `ArchitectureTest.java` only when explicitly instructed to do so.
- Never change or relax a rule merely to make a check pass; fix the code.
- The same applies to the Nx `depConstraints` in `eslint.config.mjs`.

## Locality and Single Responsibility

- Keep code that is used and changed together in the same package.
- Each class has a single, well-defined responsibility. Nested records used
  only by the enclosing class (e.g. `StdOutput`) are acceptable.

## Adding a Slice

Work inside-out and let each step be compiled by the next:

1. Domain: aggregate, `<Aggregate>Id`, value objects, events, gateway port.
2. Application: abstract use case with `Input`/`Output`, then
   `Default<UseCase>` in `impl`.
3. Infrastructure: gateway adapter (and `persistence/` types if needed),
   configuration.
4. Web: `<Aggregate>Api`, `<Aggregate>Controller`, request/response records.
5. Tests: domain and use-case tests in pure JUnit with hand-written fakes,
   `<Controller>WebMvcTest` slice test, integration test for the adapter.

The `api-add-use-case` skill walks through these steps with the greeting
slice as the template.

## Tests

- `domain` and `application` tests are pure JUnit: no Spring, no Mockito.
  Ports are replaced by hand-written fakes (a lambda for a single-method
  gateway, an in-memory class otherwise).
- Controller tests are `@WebMvcTest` slices named `<Controller>WebMvcTest`
  that import `SecurityConfiguration` and `GlobalExceptionHandler` and mock
  the use case with `@MockitoBean(answers = CALLS_REAL_METHODS)`.
- Adapter tests are integration tests named `*IT` (JPA slice or
  `@SpringBootTest`); they run in `nx run api:test`, not in the fast checks.
- `ArchitectureTest` is tagged `architecture` and is the only test the fast
  checks execute.

## Nx Project Boundaries

- `api` is tagged `type:app` and `scope:api`. It does not import from any
  other Nx project; the Angular app talks to it over HTTP only.
