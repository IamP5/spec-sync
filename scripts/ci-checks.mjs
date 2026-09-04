import { execSync } from 'node:child_process';

import {
  projects as registeredProjects,
  workspacePaths,
} from './checks/projects.mjs';

// Picks the projects whose checks must run for a set of changed files.
// `changedFiles === undefined` (unknown) selects every project; a change to a
// workspace-level file does the same. Otherwise only the projects owning at
// least one changed path are selected, so hooks stay silent for unrelated apps.
export function selectProjects(
  changedFiles,
  { projects = registeredProjects, globalPaths = workspacePaths } = {},
) {
  if (changedFiles === undefined) {
    return projects;
  }
  if (
    changedFiles.some((file) => globalPaths.some((p) => file.startsWith(p)))
  ) {
    return projects;
  }
  return projects.filter((project) =>
    changedFiles.some((file) => project.paths.some((p) => file.startsWith(p))),
  );
}

// Runs the checks of the selected projects in order and stops at the first
// failing step. Returns a discriminated result instead of throwing so callers
// can map it to whatever their environment expects (exit code, JSON, ...).
export function runChecks({
  changedFiles,
  full = false,
  capture = false,
  projects = registeredProjects,
  globalPaths = workspacePaths,
} = {}) {
  const selected = selectProjects(changedFiles, { projects, globalPaths });
  if (selected.length === 0) {
    return { status: 'skipped', projects: [] };
  }
  const names = selected.map((p) => p.name);
  for (const project of selected) {
    const steps = full
      ? [...project.fastSteps, ...project.fullOnlySteps]
      : project.fastSteps;
    for (const step of steps) {
      try {
        execSync(step, capture ? { encoding: 'utf8' } : { stdio: 'inherit' });
      } catch (error) {
        const out = capture
          ? [error.stdout, error.stderr].filter(Boolean).join('\n').trim()
          : '';
        return {
          status: 'error',
          projects: names,
          message: `[${project.name}] check failed: ${step}\n\n${out || error.message}`,
        };
      }
    }
  }
  return { status: 'success', projects: names };
}
