# ADR-0003: Error handling at the edge

- Status: accepted
- Date: 2026-09-04

## Context

The first version of the greeting endpoint validated the name inside the
controller and threw `ResponseStatusException`. That couples business rules
to HTTP and cannot be reused by a message consumer or a second endpoint.

## Decision

- Business invariants live in the domain. `AssertionConcern` raises a
  `DomainException` that carries a list of `Error(property, message)`.
  `DomainException` extends `NoStacktraceException`: it is control flow, not
  a defect, so no stack trace is captured.
- Controllers and use cases never catch `DomainException`. The single
  `@RestControllerAdvice` `GlobalExceptionHandler` in
  `infrastructure.configuration` maps it to HTTP 422 as an RFC 9457
  `ProblemDetail` with an `errors` property listing the failed properties.
- Structural validation of the HTTP payload (required fields, formats) uses
  Bean Validation on request records; it produces HTTP 400 through Spring's
  default handling. It never replaces the domain invariants.
- "Not found" is expressed with `DomainException.notFound(aggregate, id)`;
  mapping it to 404 is a decision to take in `GlobalExceptionHandler` when
  the first lookup endpoint arrives, not by string-sniffing messages.

## Consequences

- The Angular app receives one error shape for every business failure.
- Adding a new failure kind means adding a domain exception subtype and one
  handler method; controllers stay untouched.

## Addendum (2026-09-27): one error shape for every status

Every error body is an RFC 9457 `ProblemDetail` (`application/problem+json`)
with `type`, `title`, `status`, `detail` and `instance`. When properties failed,
it also carries `errors: [{property, message}]`.

| Status          | Raised by                                                     | Notes                                                                                                         |
| --------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 400             | Bean Validation, malformed JSON, missing/unparsable parameter | `errors` lists the failed fields (`GlobalExceptionHandler.handleMethodArgumentNotValid`)                      |
| 401             | Spring Security, before any controller                        | `ProblemResponses.unauthorized`; `WWW-Authenticate: Bearer`, plus `reason` when a presented token was refused |
| 402             | `InsufficientCreditsException`                                | carries `code`, `available`, `minimumCharge`, `cheaperModels`                                                 |
| 403             | Spring Security (role missing)                                | `ProblemResponses.forbidden`                                                                                  |
| 404             | `CreditRunNotFoundException`, unknown route                   |                                                                                                               |
| 405 / 406 / 415 | Spring MVC                                                    | defaults of `ResponseEntityExceptionHandler`                                                                  |
| 409             | `CreditRun*` conflicts                                        |                                                                                                               |
| 422             | `DomainException` and subtypes                                | business invariant violated                                                                                   |
| 500             | anything unexpected                                           | logged; the body never exposes internals                                                                      |
