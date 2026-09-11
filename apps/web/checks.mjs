// Quality checks for the Angular app. Consumed by `scripts/checks/projects.mjs`,
// which the agent stop hooks, the pre-commit hook and `npm run verify` share.
//
// The hooks only run these steps when a changed file starts with one of the
// `paths` prefixes, so work on other apps (e.g. `apps/api`) is not slowed down
// by Angular checks. `libs/ui` is included because it is compiled into and
// linted together with this app.
export const webChecks = {
  name: 'web',
  paths: ['apps/web/', 'libs/ui/'],
  // Fast, deterministic checks that run after every agent coding round and
  // before every commit: lint (Sheriff + Nx boundaries) and tsarch rules.
  // Nx caches every step, so an unchanged app is verified in seconds.
  fastSteps: [
    'npx nx run-many -t lint -p web,ui --output-style=static-failures-only',
    'npx nx run web:test-arch --output-style=static-failures-only',
    // Every offered locale must translate exactly the extracted messages.
    'npx nx run web:check-i18n --output-style=static-failures-only',
  ],
  // Expensive steps that only `npm run verify` (and CI) run.
  fullOnlySteps: [
    // Re-extracts the source messages to prove the committed catalogue is current.
    'npx nx run web:extract-i18n-check --output-style=static-failures-only',
    'node apps/web/scripts/check-i18n.mjs --extract',
    'npx nx run web:test --output-style=static-failures-only',
    'npx nx run web:build --output-style=static-failures-only',
  ],
};
