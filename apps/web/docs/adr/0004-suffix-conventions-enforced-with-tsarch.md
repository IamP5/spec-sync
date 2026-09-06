# ADR-0004: Suffix conventions enforced with tsarch

- Status: amended by [ADR-0005](0005-composable-features-and-pure-ui.md)
- Date: 2026-09-04

## Context

Layers (ADR-0001) cannot express every constraint. Whether a component may
talk to a store, or a store to a data access client, is a question of the
_kind_ of building block, not of the folder it lives in.

## Decision

Building blocks are identified by file-name suffixes:

- smart components: `-page.ts`, `-search.ts`, `-edit.ts`, `-detail.ts`,
  `-overview.ts`
- dumb components: `-card.ts`, `-pane.ts`, or any file in a `ui/` or
  `ui-<name>/` folder
- stores: `-store.ts`
- coordinators: `-coordinator.ts`
- data access clients: `-client.ts`

[tsarch](https://github.com/ts-arch/ts-arch) checks these rules as Vitest
tests in `apps/web/arch/` (`nx run web:test-arch`):

1. only stores (and files in an `ai/` folder) may access clients;
2. only smart components, coordinators, stores and `ai/` files may access
   stores — except when the store is co-located in the same or a child folder;
3. stores must not access other stores;
4. dumb components must not access smart components.

## Consequences

- Renaming or moving a file across suffixes re-classifies it and must be
  verified against these rules.
- Suffixes describe intent; they do not prove implementation. tsarch is one
  line of defence alongside Sheriff, the architecture documents and human
  review.
