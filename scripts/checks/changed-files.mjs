import { execSync } from 'node:child_process';

// Workspace-relative paths of the files a hook should consider changed.
// Returns `undefined` when git is unavailable so callers fall back to running
// every project's checks instead of silently skipping them.

// Files staged for the next commit (pre-commit hook).
export function stagedFiles() {
  return run('git diff --cached --name-only --diff-filter=ACMR')?.map((l) =>
    l.trim(),
  );
}

// Everything that differs from HEAD, including untracked files (agent stop
// hooks: the agent's work is normally still uncommitted when it stops).
export function uncommittedFiles() {
  const lines = run('git status --porcelain --untracked-files=all');
  return lines && parsePorcelain(lines);
}

// Parses `git status --porcelain` lines ("XY path" or "XY old -> new") into
// the paths that changed. Exported for tests.
export function parsePorcelain(lines) {
  return lines
    .map((line) => line.slice(3))
    .map((path) => {
      const arrow = path.indexOf(' -> ');
      return arrow === -1 ? path : path.slice(arrow + 4);
    })
    .filter(Boolean);
}

function run(command) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split('\n')
      .filter((line) => line.length > 0);
  } catch {
    return undefined;
  }
}
