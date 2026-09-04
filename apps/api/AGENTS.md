# SpecSync API (Spring Boot 4, Java 25)

Spring Boot application built with Gradle inside the Nx workspace. Base
package `com.fiap.ford.specsync`. Paths below are relative to the workspace
root.

You are an expert in Java, Spring Boot and clean architecture. You write
small, explicit, framework-light code with the domain at the centre and the
frameworks at the edges.

## Architecture (red lines)

The binding rules live in the docs; this section only names the red lines.

- Read `apps/api/docs/architecture-boundaries.md` before changing code under
  `apps/api`. The reasoning behind the rules is recorded in
  `apps/api/docs/adr/`.
- Four rings, dependencies point inwards only:
  `web` / `infrastructure` → `application` → `domain`. The domain is
  framework-free (no Spring, Jakarta, JPA, Lombok, Jackson).
- Controllers depend on use-case abstractions only. They never touch a
  `*Gateway`, a `Default*` class or anything under `infrastructure`.
- Ports are `*Gateway` interfaces next to their aggregate in `domain`;
  adapters implement them in `infrastructure.gateway.<aggregate>`. JPA
  entities and Spring Data repositories stay inside `...persistence` and never
  cross into other layers.
- Use cases are abstract verb-first classes with nested `Input`/`Output` and
  a `Default*` implementation in `impl` (`@Service`, constructor injection).
- Business invariants raise `DomainException`; the `GlobalExceptionHandler`
  maps it to HTTP 422. Controllers never catch it.
- Do not change `ArchitectureTest.java`, the Gradle build or the Nx tags
  without an explicit request in the current conversation.
- Model new slices after the greeting slice (`Greeting`, `HashGateway`,
  `CreateGreeting`, `DefaultCreateGreeting`, `UuidHashGateway`,
  `GreetingApi`, `GreetingController`, `GreetingResponse`).

## Checks

- Formatting (Spotless, palantir-java-format):
  `npm exec -- nx run api:spotlessCheck`; fix with
  `npm exec -- nx run api:spotlessApply`.
- Architecture rules (ArchUnit): `npm exec -- nx run api:archTest`
- Whole test suite: `npm exec -- nx run api:test`
- Everything incl. tests and the boot jar for all apps: `npm run verify`
  (`npm run verify:changed` restricts it to the apps with uncommitted
  changes).
- The checks are declared in `apps/api/checks.mjs`. The agent Stop hooks and
  the pre-commit hook run the fast ones (Spotless, ArchUnit) whenever files
  under `apps/api` changed and feed failures back. Fix the code; never weaken
  a rule to make a check pass.
- Use the `api-architecture-review` skill for reviews, `api-add-use-case`
  when adding a slice and `api-verify-and-fix` before declaring work
  merge-ready.

## Java and Spring Best Practices

- Java 25: use records for value objects, DTOs and identifiers; sealed
  interfaces for closed hierarchies (events, commands); pattern-matching
  `switch` over sealed types; `var` for obvious local types.
- Constructor injection only; mark dependencies `final` and null-check them
  with `Objects.requireNonNull`.
- `@Configuration(proxyBeanMethods = false)` for configuration classes.
- No Lombok anywhere; no field injection; no static mutable state.
- Keep Spring annotations at the edges: `@Service` on `Default*`,
  `@Repository`/`@Component` on adapters, `@RestController` on controllers,
  `@Configuration` in `infrastructure.configuration`.
- Prefer `RestClient` over `RestTemplate`; prefer `ProblemDetail` over ad-hoc
  error bodies.
- Externalised configuration goes through `@ConfigurationProperties` records
  in `infrastructure.configuration`; never read `System.getenv` in code.

## Testing

- `domain` and `application` tests are pure JUnit 5 with hand-written fakes
  (a lambda for a single-method gateway). No Spring, no Mockito there.
- Controllers get a `<Controller>WebMvcTest` slice test that imports
  `SecurityConfiguration` and `GlobalExceptionHandler` and mocks the use case
  with `@MockitoBean(answers = CALLS_REAL_METHODS)` (Boot 4 packages:
  `org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest`).
- Adapters get integration tests named `*IT` (JPA slice with H2, or
  `@SpringBootTest`). `src/test/resources/application.properties` keeps the
  Google Cloud clients and the chat model out of the test context; keep it
  that way.
- Test names describe behaviour (`rejectsBlankName`), not methods.

## Configuration and profiles

- `application.properties` is the local default (Docker Compose Postgres via
  `compose.yaml` at the workspace root), `application-cloud.properties` the
  Cloud Run profile, `application-aot.properties` the AOT training profile.
- Deployment lives in `infra/` (Terraform) and `tools/deploy/api.sh`; the
  `deploy` Nx target wraps it.

## Agent configuration

- Skills for this app live in `apps/api/.agents/skills/`
  (`api-architecture-review`, `api-add-use-case`, `api-verify-and-fix`).
  `npm run sync:agent-config` generates `apps/api/.claude/skills/` from them;
  do not edit that copy.
- Start Claude from this directory (`cd apps/api && claude`) to have these
  skills and this file loaded at launch; from the workspace root they load
  once Claude touches files under `apps/api`.
- Cursor rules for this app live in `apps/api/.cursor/rules/`.
