import process from 'node:process';

import { uncommittedFiles } from '../checks/changed-files.mjs';
import { runChecks } from '../ci-checks.mjs';
import { readInput } from './read-input.mjs';

// Cursor conventions: always exit 0 and answer with JSON on stdout. A
// `followup_message` makes the agent continue with that feedback; `{}` lets
// it stop. Skips the checks when the user aborted the run, and only checks the
// projects with uncommitted changes (see scripts/checks/projects.mjs).
const input = await readInput();

if (input.status !== 'aborted') {
  const result = runChecks({ capture: true, changedFiles: uncommittedFiles() });
  if (result.status === 'error') {
    process.stdout.write(JSON.stringify({ followup_message: result.message }));
    process.exit(0);
  }
}

process.stdout.write('{}');
process.exit(0);
