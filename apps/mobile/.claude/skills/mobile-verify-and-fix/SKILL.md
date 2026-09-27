---
name: mobile-verify-and-fix
description: Verifying apps/mobile before commit or merge - run the full checks (lint incl. Sheriff, typecheck, architecture tests, jest-expo tests, iOS/Android bundles) and fix failures. Use when asked to verify, run the full checks, or make mobile work merge-ready.
disable-model-invocation: true
---

# Full Verify and Fix

Run the full quality checks and resolve every problem until they pass. The
stop hook only runs the fast checks (lint, typecheck, architecture tests), so
this skill is the on-demand full pass before committing or pushing.

## Run

```bash
npm run verify:changed
```

It stops at the first failing step. The mobile steps are declared in
`apps/mobile/checks.mjs` and run by `scripts/ci-checks.mjs`; `npm run verify`
runs every app.

## Fix loop

1. Run `npm run verify:changed`.
2. On failure, diagnose the **root cause**, not the symptom. Never weaken
   lint, Sheriff, the architecture tests, or the Nx module boundaries to make
   a check pass — fix the code instead. The rules live in
   `apps/mobile/docs/architecture-boundaries.md` and
   `apps/mobile/docs/architecture-state-management.md`.
3. **Propose the fixes first.** Summarize each problem and the change you
   intend to make, then wait for the user's confirmation. Do **not** edit any
   files until the user approves.
4. After the user confirms, apply the approved fixes.
5. Re-run the checks. If new problems appear, go back to step 2 (propose,
   confirm, then apply) and repeat until every step passes.
6. Report success only once the run is fully green.

## Notes

- A bundle failure (`mobile:export`) usually means Metro cannot resolve or
  transform a module: check `metro.config.js` (Nx, Uniwind, the `jose`
  resolver) before touching app code.
- `nx run mobile:doctor` (expo-doctor) is not part of verify because it
  needs the network; run it after dependency changes.
- Do not edit the generated `.claude/skills/` copy; this skill lives in
  `apps/mobile/.agents/skills/`.
