# ADR-0003: Feature slicing and shared code

- Status: accepted
- Date: 2026-09-04

## Context

Agents tend to generalise early: helpers land in `shared`, and abstractions
appear before a second consumer exists. That increases coupling and cognitive
load.

## Decision

Code stays local to the feature that uses it. It is moved down to a lower
layer of the same domain only when a second feature of that domain needs it,
and to `shared` only when at least two independent features in different
domains need it _and_ the code is technical rather than domain-specific.
Moving domain-specific code to `shared` requires explicit user approval in the
current conversation.

## Consequences

- Refactoring towards lower layers is an expected, ordinary step, not a sign
  of a wrong initial placement.
- `shared` is a deliberate decision, never a fallback folder.
