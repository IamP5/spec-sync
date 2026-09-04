---
name: api-add-use-case
description: Adding a new endpoint, use case, aggregate or adapter to the Spring Boot API in apps/api following the clean architecture slice (domain -> application -> infrastructure -> web) with tests. Use when asked to add or extend an API feature.
---

# Add a Use Case to the API

Follow the greeting slice as the template and work inside-out. Read
`apps/api/docs/architecture-boundaries.md` first; the naming rules there are
enforced by ArchUnit and will fail the hooks if ignored.

Base package: `com.fiap.ford.specsync`. Replace `<aggregate>` / `<Aggregate>`
with the singular aggregate name and `<Verb>` with the action.

## 1. Domain (`domain.<aggregate>`)

- `<Aggregate>Id`: record implementing `Identifier<String>` (or another
  type) with a static `from(...)`.
- `<Aggregate>`: extends `AggregateRoot<<Aggregate>Id>`; private
  constructor; factories `newX(...)` (validates, may `registerEvent`) and
  `with(...)` (rehydration, no events). Invariants via `AssertionConcern`.
- Value objects as records implementing `ValueObject`.
- Events (optional): `events/<Aggregate>Event` sealed interface plus
  past-tense records implementing `DomainEvent`.
- Ports: `<Aggregate>Gateway` interface (`save`, `findById`, ...) or a
  narrower `<Concern>Gateway`. Return domain types, never JPA entities.

Template: `domain/greeting/Greeting.java`, `GreetingId.java`,
`HashGateway.java`.

## 2. Application (`application.<aggregate>`)

- `<Verb><Aggregate>`: abstract class extending `UseCase<Input, Output>`
  (`NullaryUseCase` without input, `UnitUseCase` without output) with nested
  `record Input(...)` and `interface Output { ... }`.
- `impl/Default<Verb><Aggregate>`: `@Service`, constructor-injected ports,
  `execute` builds the aggregate, calls the gateways and returns a
  package-private `record StdOutput(...) implements Output`.

Template: `application/greeting/CreateGreeting.java`,
`application/greeting/impl/DefaultCreateGreeting.java`.

## 3. Infrastructure (`infrastructure.gateway.<aggregate>`)

- Adapter `<Aggregate>JpaGateway` (`@Repository`) implementing
  `<Aggregate>Gateway`, or `<Aggregate><Technology>Gateway` /
  `<Vendor>Client` (`@Component`) for non-persistence ports.
- Persistence types in `persistence/`: `<Aggregate>JpaEntity` (`@Entity`)
  with `from(<Aggregate>)` / `toAggregate()` mapping, and
  `<Aggregate>JpaRepository extends JpaRepository<...>`.
- Never let a JPA entity or repository escape `infrastructure`.

Template: `infrastructure/gateway/greeting/UuidHashGateway.java`.

## 4. Web (`web`)

- `api/<Aggregate>Api`: interface with `@Tag`, `@RequestMapping`, the
  method mappings, `@Operation`/`@ApiResponses` and `@Valid` on bodies.
- `controllers/<Aggregate>Controller`: `@RestController implements
<Aggregate>Api`, injects the use-case abstraction, returns
  `useCase.execute(new Input(...), <Aggregate>Response::from)`.
- `dto/request/<Verb><Aggregate>Request`: record with Bean Validation.
- `dto/response/<Aggregate>Response`: record with `static from(Output)`.
- Add the path to `SecurityConfiguration` if it must be public.

Template: `web/api/GreetingApi.java`, `web/controllers/GreetingController.java`,
`web/dto/response/GreetingResponse.java`.

## 5. Tests (`src/test/java/...`)

- `domain/<aggregate>/<Aggregate>Test`: pure JUnit, factories and
  invariants.
- `application/<aggregate>/impl/Default<Verb><Aggregate>Test`: pure JUnit,
  hand-written fakes for the gateways (a lambda for single-method ports, an
  in-memory class otherwise).
- `web/controllers/<Aggregate>ControllerWebMvcTest`: `@WebMvcTest`,
  `@Import({SecurityConfiguration.class, GlobalExceptionHandler.class})`,
  `@MockitoBean(answers = Answers.CALLS_REAL_METHODS)` for the use case.
- `infrastructure/gateway/<aggregate>/<Aggregate>JpaGatewayIT`: JPA slice
  test for the adapter when persistence is involved.

## 6. Verify

```bash
npm exec -- nx run api:spotlessApply
npm exec -- nx run api:archTest
npm exec -- nx run api:test
```

## Do not

- Put business rules in controllers or throw `ResponseStatusException` for
  them.
- Inject a gateway or a `Default*` class into a controller.
- Return a JPA entity from a gateway or expose it in a DTO.
- Use Lombok, field injection or `@Component` inside `application`.
- Edit `ArchitectureTest.java` to make a rule pass.
