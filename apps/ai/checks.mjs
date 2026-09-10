// Quality checks for the Mastra AI service. Consumed by `scripts/checks/projects.mjs`,
// which the agent stop hooks, the pre-commit hook and `npm run verify` share.
//
// The hooks only run these steps when a changed file starts with one of the
// `paths` prefixes, so work on the other apps is not slowed down by them.
export const aiChecks = {
  name: 'ai',
  paths: ['apps/ai/', 'apps/api/data/'],
  // Fast, deterministic checks that run after every agent coding round and
  // before every commit: deterministic fixtures, lint and a strict type check.
  fastSteps: [
    'npx nx run ai:data-test --output-style=static-failures-only',
    'npx nx run ai:benchmark-test --output-style=static-failures-only',
    'npx nx run ai:lint --output-style=static-failures-only',
    'npx nx run ai:typecheck --output-style=static-failures-only',
  ],
  // Expensive steps that only `npm run verify` (and CI) run: unit tests and
  // the Mastra bundle (`mastra build` installs the output's node_modules).
  fullOnlySteps: [
    'npx nx run ai:test --output-style=static-failures-only',
    'npx nx run ai:build --output-style=static-failures-only',
  ],
};
