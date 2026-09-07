# ADR-0007: Generic domain boundaries

Status: Accepted

## Context

Sheriff and the supporting architecture checks accumulated permissions for named
domains and coordinator files. Adding a domain required editing the validators,
and future state owners did not inherit the same privacy checks.

The flights42 [base configuration](https://github.com/angular-architects/flights42/blob/ai-arc/sheriff.config.ts)
uses placeholders and layer tags. Its [API configuration](https://github.com/angular-architects/flights42/blob/ai-arc/sheriff.config.api.ts)
separates public APIs but retains named consumer grants. We adopt the placeholder
and API separation patterns with purpose-based access for every domain.

## Decision

Derive domain ownership and API purpose from directory placeholders. Permit
cross-domain imports only through typed public entries, constrained by consumer
layer. Public APIs depend on their own domain and shared technical code. Shared
code cannot depend on business domains. Keep the domain matcher in one rule:
Sheriff combines matching rules additively, so overlapping wildcard grants cannot
be used as restrictive overrides.

Name public coordinator entries after capabilities: `auth/api/authentication`,
`chat/api/connection` and `user/api/preferences`. All `api/<capability>` entries
inherit one generic rule; technical entries (`contracts`, `features`, `events`,
`session`, `bootstrap`) keep their specific restrictions. Capability names do not
appear in the Sheriff configuration.

Protect every domain's private state and feature internals by structural rules
instead of coordinator or domain names. Root composition also uses public APIs.
Retain transitive UI/contract purity, store/client access rules and feature cycle
checks. Reject unclassified domain code and non-coordinator capability exports.

The binding permission matrix lives in
[architecture-boundaries.md](../architecture-boundaries.md). This decision replaces
the named-domain access grants introduced by earlier architecture decisions;
domain responsibilities and authentication behavior remain unchanged.

## Consequences

Adding domains, capabilities, features or coordinators within the conventions needs
no validator edits. Adding an architectural layer or technical API role still requires an intentional
rule and validation tests. Architectural permissions no longer encode business
relationships between particular domains; ownership and acyclic public feature
composition constrain those relationships.

Tests exercise the actual Sheriff config with temporary fixtures using new domain
names, covering both allowed and forbidden dependencies. Separate structural tests
cover private exports, unknown folders and cycles through public APIs.
