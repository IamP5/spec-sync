import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({ execSync: vi.fn() }));

import { execSync } from 'node:child_process';

import { runChecks, selectProjects } from './ci-checks.mjs';

const execSyncMock = vi.mocked(execSync);

const web = {
  name: 'web',
  paths: ['apps/web/', 'libs/ui/'],
  fastSteps: ['lint web', 'arch web'],
  fullOnlySteps: ['test web', 'build web'],
};
const api = {
  name: 'api',
  paths: ['apps/api/'],
  fastSteps: ['test api'],
  fullOnlySteps: [],
};
const registry = { projects: [web, api], globalPaths: ['package.json'] };

function execFailure({ stdout = '', stderr = '' }) {
  return Object.assign(new Error('Command failed'), { stdout, stderr });
}

describe('selectProjects', () => {
  it('selects every project when the changed files are unknown', () => {
    expect(selectProjects(undefined, registry)).toEqual([web, api]);
  });

  it('selects only the projects owning a changed path', () => {
    expect(selectProjects(['apps/api/src/Main.java'], registry)).toEqual([api]);
    expect(selectProjects(['libs/ui/index.ts'], registry)).toEqual([web]);
  });

  it('selects nothing when no registered project changed', () => {
    expect(selectProjects(['infra/main.tf', 'README.md'], registry)).toEqual(
      [],
    );
  });

  it('selects every project when a workspace-level file changed', () => {
    expect(selectProjects(['package.json'], registry)).toEqual([web, api]);
  });
});

describe('runChecks', () => {
  beforeEach(() => {
    execSyncMock.mockReset();
  });

  it('runs the fast steps of the selected projects and succeeds when all pass', () => {
    execSyncMock.mockReturnValue('ok');

    expect(
      runChecks({ changedFiles: ['apps/web/src/main.ts'], ...registry }),
    ).toEqual({
      status: 'success',
      projects: ['web'],
    });
    expect(execSyncMock.mock.calls.map(([cmd]) => cmd)).toEqual(web.fastSteps);
  });

  it('skips without running anything when no project changed', () => {
    expect(runChecks({ changedFiles: ['infra/main.tf'], ...registry })).toEqual(
      {
        status: 'skipped',
        projects: [],
      },
    );
    expect(execSyncMock).not.toHaveBeenCalled();
  });

  it('runs every project including the full-only steps in full mode', () => {
    execSyncMock.mockReturnValue('ok');

    expect(runChecks({ full: true, ...registry }).status).toBe('success');
    expect(execSyncMock.mock.calls.map(([cmd]) => cmd)).toEqual([
      ...web.fastSteps,
      ...web.fullOnlySteps,
      ...api.fastSteps,
    ]);
  });

  it('returns an error result naming the project and carrying captured output', () => {
    execSyncMock.mockImplementation(() => {
      throw execFailure({ stdout: 'error  Unexpected store dependency' });
    });

    const result = runChecks({
      capture: true,
      changedFiles: ['apps/web/x.ts'],
      ...registry,
    });

    expect(result.status).toBe('error');
    expect(result.message).toContain('[web] check failed: lint web');
    expect(result.message).toContain('Unexpected store dependency');
  });

  it('also captures stderr output', () => {
    execSyncMock.mockImplementation(() => {
      throw execFailure({ stderr: 'FAIL arch/access-rules.spec.ts' });
    });

    const result = runChecks({ capture: true, ...registry });

    expect(result.status).toBe('error');
    expect(result.message).toMatch(/FAIL arch\/access-rules/);
  });

  it('stops at the first failing step', () => {
    execSyncMock.mockImplementationOnce(() => {
      throw execFailure({ stdout: 'boom' });
    });

    expect(runChecks({ capture: true, ...registry }).status).toBe('error');
    expect(execSyncMock).toHaveBeenCalledTimes(1);
  });
});
