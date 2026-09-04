---
name: web-architecture-review
description: Reviewing or auditing Angular code in apps/web or libs/ui against the architecture rules (Sheriff boundaries, tsarch suffix rules, layering, feature slicing, shared code, state management). Use for architecture reviews of changes under apps/web.
---

# Review Angular Architecture

Use this skill when reviewing Angular code for architectural quality.

Before reviewing, read:

- `apps/web/docs/architecture-boundaries.md`
- `AGENTS.md` if present
- `apps/web/docs/architecture-state-management.md` if state management is involved
- `apps/web/sheriff.config.ts` and `apps/web/arch/access-rules.spec.ts`
- the changed files and their imports

Treat `apps/web/docs/architecture-boundaries.md` as the source of truth.

Do not invent additional rules. If something is not covered by
`apps/web/docs/architecture-boundaries.md`, infer cautiously from existing code and
mark it as an inference.

## Process

1. Identify the affected feature, domain, and layer.
2. Check the changed files and their imports.
3. Compare the change against `apps/web/docs/architecture-boundaries.md`.
4. Check whether Sheriff boundaries are respected.
5. Check whether file-name suffixes match the building block (smart/dumb
   component, store, coordinator, client) and whether the tsarch access
   rules hold.
6. Check whether code is placed in the right feature, layer, or shared area.
7. If state management is involved, also apply
   `apps/web/docs/architecture-state-management.md`.
8. Report only concrete findings and recommend the smallest useful fix.

## Output

Provide:

- summary
- findings by severity
- affected files
- violated rule from `apps/web/docs/architecture-boundaries.md`
- concrete fix
- checks that should be run (`npx nx run-many -t lint -p web,ui`,
  `npx nx run web:test-arch`, or `npm run verify`)
