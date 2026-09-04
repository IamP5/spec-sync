import process from 'node:process';

import { stagedFiles } from '../checks/changed-files.mjs';
import { runChecks } from '../ci-checks.mjs';

// Pre-commit: run the fast checks of the projects touched by the staged
// files only. Unknown staged set (git error) runs everything to stay safe.
const result = runChecks({ changedFiles: stagedFiles() });

if (result.status === 'error') {
  console.error(result.message);
  process.exit(1);
}
if (result.status === 'skipped') {
  console.log('[pre-commit] no registered project staged; checks skipped');
}
