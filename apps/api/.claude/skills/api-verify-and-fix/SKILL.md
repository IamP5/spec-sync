---
name: api-verify-and-fix
description: Verifying apps/api before commit or merge - run the full checks (Spotless, ArchUnit, unit, slice and context tests, boot jar) and fix failures. Use when asked to verify, run the full checks, or make API work merge-ready.
disable-model-invocation: true
---

# Full Verify and Fix (API)

Run the full quality checks of the Spring Boot API and resolve every problem
until they pass. The stop hook only runs the fast checks (Spotless,
ArchUnit), so this skill is the on-demand full pass before committing or
pushing.

## Run

```bash
npm run verify:changed
```

It runs the full checks of every app with uncommitted changes and stops at
the first failing step. The API steps are defined in `apps/api/checks.mjs`;
to run only the API:

```bash
npm exec -- nx run api:spotlessCheck && npm exec -- nx run api:archTest && npm exec -- nx run api:test && npm exec -- nx run api:bootJar
```

## Fix loop

1. Run the checks.
2. On failure, diagnose the **root cause**, not the symptom. Never weaken an
   ArchUnit rule, the Spotless configuration or the Nx boundaries to make a
   check pass; fix the code instead. The rules live in
   `apps/api/docs/architecture-boundaries.md`. Formatting failures are fixed
   with `npm exec -- nx run api:spotlessApply`.
3. **Propose the fixes first.** Summarize each problem and the change you
   intend to make, then wait for the user's confirmation. Do **not** edit any
   files until the user approves.
4. After the user confirms, apply the approved fixes.
5. Re-run the checks. If new problems appear, go back to step 2 (propose,
   confirm, then apply) and repeat until every step passes.
6. Report success only once every step is green.

## Notes

- Test reports are written to `apps/api/build/reports/tests/`; Gradle's own
  console output already names the failing test and assertion.
- Do not edit the generated `.claude/skills/` copy; this skill lives in
  `apps/api/.agents/skills/`.
