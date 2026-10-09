// Quality checks for the Expo app. Consumed by `scripts/checks/projects.mjs`,
// which the agent stop hooks, the pre-commit hook and `npm run verify` share.
//
// The hooks only run these steps when a changed file starts with one of the
// `paths` prefixes, so work on other apps is not slowed down by Expo checks.
export const mobileChecks = {
  name: 'mobile',
  paths: ['apps/mobile/'],
  // Fast, deterministic checks that run after every agent coding round and
  // before every commit: lint (Sheriff + Nx boundaries + the Expo/React
  // Native rules), the TypeScript check and the architecture tests. Nx caches
  // every step, so an unchanged app is verified in seconds.
  fastSteps: [
    'npx nx run mobile:lint --output-style=static-failures-only',
    'npx nx run mobile:typecheck --output-style=static-failures-only',
    'npx nx run mobile:test-arch --output-style=static-failures-only',
  ],
  // Expensive steps that only `npm run verify` (and CI) run: the jest-expo
  // unit tests and the Hermes bundles for iOS and Android, which is where
  // Metro, Uniwind and the CopilotKit polyfills would break.
  fullOnlySteps: [
    'npx nx run mobile:test --output-style=static-failures-only',
    'npx nx run mobile:export --platform ios --platform android --output-style=static-failures-only',
  ],
};
