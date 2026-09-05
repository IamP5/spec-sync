// Quality checks for the Spring Boot API. Consumed by `scripts/checks/projects.mjs`,
// which the agent stop hooks, the pre-commit hook and `npm run verify` share.
//
// The hooks only run these steps when a changed file starts with one of the
// `paths` prefixes, so work on the Angular app is not slowed down by Gradle.
// Every step is a Gradle task inferred by `@nx/gradle` (see `apps/api/build.gradle`).
// `apps/api/project.json` overrides these targets with `dependsOn: []` and
// `excludeDependsOn: false` so Gradle compiles on its own: the inferred chain
// would otherwise schedule the continuous `classes` target, which never ends
// in a terminal.
export const apiChecks = {
  name: 'api',
  paths: ['apps/api/'],
  // Fast, deterministic checks that run after every agent coding round and
  // before every commit: formatting (Spotless) and the ArchUnit rules.
  // `archTest` compiles main and test sources, so a compile error surfaces here too.
  fastSteps: [
    'npx nx run api:data-test --output-style=static-failures-only',
    'npx nx run api:spotlessCheck --output-style=static-failures-only',
    'npx nx run api:archTest --output-style=static-failures-only',
  ],
  // Expensive steps that only `npm run verify` (and CI) run: the whole test
  // suite (unit, slice and context tests, ArchUnit included) and the boot jar.
  fullOnlySteps: [
    'npx nx run api:test --output-style=static-failures-only',
    'npx nx run api:bootJar --output-style=static-failures-only',
  ],
};
