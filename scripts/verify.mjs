import process from 'node:process';

import { runChecks } from './ci-checks.mjs';

// Human-facing entry point for `npm run verify`: runs the full suite of every
// registered project with live output and exits non-zero on the first failing
// step. Pass `--changed` to restrict it to the projects with uncommitted changes.
const changed = process.argv.includes('--changed');
const { uncommittedFiles } = changed
  ? await import('./checks/changed-files.mjs')
  : { uncommittedFiles: () => undefined };

const result = runChecks({ full: true, changedFiles: uncommittedFiles() });

if (result.status === 'error') {
  console.error(result.message);
  process.exit(1);
}
if (result.status === 'skipped') {
  console.log('[verify] no registered project changed; nothing to check');
}
