---
name: web-verify-and-fix
description: Verifying apps/web before commit or merge - run the full checks (lint incl. Sheriff, tsarch, unit tests, build) and fix failures. Use when asked to verify, run the full checks, or make web work merge-ready.
disable-model-invocation: true
---

# Full Verify and Fix

Run the full quality checks and resolve every problem until they pass. The
stop hook only runs the fast checks (lint, tsarch, script tests), so this
skill is the on-demand full pass before committing or pushing.

## Run

```bash
npm run verify
```

It stops at the first failing step. The steps are defined in
`scripts/ci-checks.mjs`.

## Fix loop

1. Run `npm run verify`.
2. On failure, diagnose the **root cause**, not the symptom. Never weaken
   lint, Sheriff, the tsarch rules, or the Nx module boundaries to make a
   check pass — fix the code instead. The rules live in
   `apps/web/docs/architecture-boundaries.md` and
   `apps/web/docs/architecture-state-management.md`.
3. **Propose the fixes first.** Summarize each problem and the change you
   intend to make, then wait for the user's confirmation. Do **not** edit any
   files until the user approves.
4. After the user confirms, apply the approved fixes.
5. Re-run `npm run verify`. If new problems appear, go back to step 2
   (propose, confirm, then apply) and repeat until every step passes.
6. Report success only once `npm run verify` is fully green.

## Notes

- Do not edit the generated `.claude/skills/` copy; this skill lives in
  `apps/web/.agents/skills/`.
- `npm run verify` also runs the Spring Boot API checks (`apps/api/checks.mjs`).
  Use `npm run verify:changed` to restrict the run to the apps with
  uncommitted changes, or the `api-verify-and-fix` skill for API failures.
