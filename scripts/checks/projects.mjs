import { webChecks } from '../../apps/web/checks.mjs';

// Registry of per-project checks. Each app owns its definition next to its
// code (e.g. `apps/web/checks.mjs`); register it here so the hooks and
// `npm run verify` pick it up. Add `apps/api/checks.mjs` here when the Spring
// Boot hooks arrive.
//
// Shape of an entry:
//   { name, paths: ['apps/x/'], fastSteps: [...], fullOnlySteps: [...] }
// `paths` are workspace-relative prefixes; a project's checks run when at
// least one changed file starts with one of them.
export const projects = [
  webChecks,
  {
    name: 'scripts',
    paths: ['scripts/'],
    fastSteps: ['npx nx run scripts:test --output-style=static-failures-only'],
    fullOnlySteps: [],
  },
];

// Workspace-level files that can break any project. A change to one of them
// runs the checks of every registered project.
export const workspacePaths = [
  'package.json',
  'package-lock.json',
  'nx.json',
  'tsconfig.base.json',
  'eslint.config.mjs',
  'sheriff.config.ts',
  '.github/',
];
