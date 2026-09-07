import { gatewayChecks } from '../../apps/gateway/checks.mjs';
import { aiChecks } from '../../apps/ai/checks.mjs';
import { apiChecks } from '../../apps/api/checks.mjs';
import { webChecks } from '../../apps/web/checks.mjs';

// Registry of per-project checks. Each app owns its definition next to its
// code (`apps/web/checks.mjs`, `apps/api/checks.mjs`); register it here so the
// hooks and `npm run verify` pick it up.
//
// Shape of an entry:
//   { name, paths: ['apps/x/'], fastSteps: [...], fullOnlySteps: [...] }
// `paths` are workspace-relative prefixes; a project's checks run when at
// least one changed file starts with one of them.
export const projects = [
  webChecks,
  apiChecks,
  aiChecks,
  gatewayChecks,
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
