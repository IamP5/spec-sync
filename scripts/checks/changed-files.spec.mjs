import { describe, expect, it } from 'vitest';

import { parsePorcelain } from './changed-files.mjs';

describe('parsePorcelain', () => {
  it('keeps the leading path segment of modified, added and untracked files', () => {
    expect(
      parsePorcelain([
        ' M .claude/settings.json',
        'A  apps/web/checks.mjs',
        '?? apps/api/src/Main.java',
      ]),
    ).toEqual([
      '.claude/settings.json',
      'apps/web/checks.mjs',
      'apps/api/src/Main.java',
    ]);
  });

  it('uses the new path of a rename', () => {
    expect(parsePorcelain(['R  docs/a.md -> apps/web/docs/a.md'])).toEqual([
      'apps/web/docs/a.md',
    ]);
  });
});
