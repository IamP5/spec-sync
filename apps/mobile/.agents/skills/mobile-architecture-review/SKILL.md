---
name: mobile-architecture-review
description: Reviewing or auditing Expo/React Native code in apps/mobile against the architecture rules (Sheriff boundaries, tsarch suffix rules, routes-only src/app, layering, feature slicing, design system, state management). Use for architecture reviews of changes under apps/mobile.
---

# Review Mobile Architecture

Use this skill when reviewing code in `apps/mobile` for architectural quality.

Before reviewing, read:

- `apps/mobile/docs/architecture-boundaries.md`
- `apps/mobile/AGENTS.md`
- `apps/mobile/docs/architecture-state-management.md` if stores, queries,
  forms or the chat are involved
- `apps/mobile/sheriff.config.ts`, `apps/mobile/arch/access-rules.spec.ts`
  and `apps/mobile/arch/feature-boundaries.ts`
- the changed files and their imports

Treat `apps/mobile/docs/architecture-boundaries.md` as the source of truth.

Do not invent additional rules. If something is not covered there, infer
cautiously from existing code (the `chat` domain is the reference) and mark it
as an inference. For Expo or React Native practice, cite the installed skill
(`expo-router`, `expo-data-fetching`, `vercel-react-native-skills`, ...)
instead of memory.

## Process

1. Identify the affected route, feature, domain, and layer.
2. Check the changed files and their imports.
3. Compare the change against `apps/mobile/docs/architecture-boundaries.md`.
4. Check that `src/app` holds thin routes only and that routes use public
   entries (`api/features`, `api/bootstrap`).
5. Check that file-name suffixes match the building block (smart screen, dumb
   component, store, coordinator, client) and that the access rules hold,
   including dumb UI staying away from queries, forms, CopilotKit and
   navigation.
6. Check that UI uses the design system and tokens (no raw colours, no
   `react-native` `Text`/`TextInput`, virtualized lists, `expo-image`).
7. If state is involved, apply
   `apps/mobile/docs/architecture-state-management.md`; for chat changes,
   also `docs/adr/0001-agentic-ui-contracts.md` at the workspace root.
8. Report only concrete findings and recommend the smallest useful fix.

## Output

Provide:

- summary
- findings by severity
- affected files
- violated rule from `apps/mobile/docs/architecture-boundaries.md`
- concrete fix
- checks that should be run (`npx nx run mobile:lint`,
  `npx nx run mobile:test-arch`, or `npm run verify`)
