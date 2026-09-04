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
