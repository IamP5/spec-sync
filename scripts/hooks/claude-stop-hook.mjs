import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { uncommittedFiles } from '../checks/changed-files.mjs';
import { runChecks } from '../ci-checks.mjs';
import { readInput } from './read-input.mjs';

// Claude Code conventions: exit code 2 blocks the stop and replays stderr to
// the agent as feedback; exit code 0 lets the agent stop.
//
// Claude Code has no built-in loop limit for Stop hooks, so this hook keeps a
// per-session counter of consecutive blocks and gives up after LOOP_LIMIT
// rounds (mirrors Cursor's `loop_limit`). The counter resets as soon as the
// checks pass.
//
// Only the projects with uncommitted changes are checked (see
// scripts/checks/projects.mjs), so a round that touched only `apps/api` never
// runs the Angular checks.
const LOOP_LIMIT = 3;

const input = await readInput();
const counterFile = join(
  tmpdir(),
  'specsync-stop-hook',
  `${input.session_id ?? 'default'}.json`,
);

const result = runChecks({ capture: true, changedFiles: uncommittedFiles() });

if (result.status !== 'error') {
  writeCounter(0);
  process.exit(0);
}

const blocked = readCounter() + 1;
writeCounter(blocked);

if (blocked > LOOP_LIMIT) {
  process.stderr.write(
    `Checks still failing after ${LOOP_LIMIT} automatic correction rounds; ` +
      'stopping without blocking. Run `npm run verify` and fix manually.\n\n' +
      result.message,
  );
  process.exit(0);
}

process.stderr.write(
  `${result.message}\n\n(automatic correction round ${blocked} of ${LOOP_LIMIT})`,
);
process.exit(2);

function readCounter() {
  try {
    return existsSync(counterFile)
      ? Number(JSON.parse(readFileSync(counterFile, 'utf8')).blocked) || 0
      : 0;
  } catch {
    return 0;
  }
}

function writeCounter(blocked) {
  try {
    mkdirSync(join(tmpdir(), 'specsync-stop-hook'), { recursive: true });
    writeFileSync(counterFile, JSON.stringify({ blocked }));
  } catch {
    // Best effort: a missing counter only disables the loop limit.
  }
}
