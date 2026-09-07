import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';

import { getProjectData, violatesDependencyRule } from '@softarc/sheriff-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Run the actual Sheriff parser and matcher against the production config.
// These domains deliberately do not exist in the application.
const fixture = mkdtempSync(join(tmpdir(), 'specsync-sheriff-'));
const app = 'apps/web/src/app';
const domain = (name: string, layer: string) =>
  `${app}/domains/${name}/${layer}`;
const orders = (layer: string) => domain('orders', layer);
const billing = (layer: string) => domain('billing', layer);
const shared = (layer: string) => domain('shared', layer);

const cases: [string, string, boolean][] = [
  [orders('feature-list'), orders('data'), true],
  [orders('feature-list'), orders('feature-edit'), true],
  [orders('feature-list'), billing('api/features'), true],
  [orders('feature-list'), billing('api/notifications'), true],
  [orders('feature-list'), billing('api/contracts'), true],
  [orders('feature-list'), billing('api/session'), true],
  [orders('state'), billing('api/events'), true],
  [orders('data'), billing('api/session'), true],
  [orders('data'), billing('api/contracts'), true],
  [orders('ui-card'), billing('api/contracts'), true],
  [orders('data'), shared('util-format'), true],
  [orders('api/features'), orders('feature-list'), true],
  [orders('api/notifications'), orders('state'), true],
  [orders('api/new-capability'), orders('state'), true],
  [orders('api/bootstrap'), orders('transport'), true],
  [`${app}/shell`, billing('api/features'), true],
  [`${app}/shell`, billing('api/notifications'), true],
  [orders('feature-list'), billing('data'), false],
  [orders('feature-list'), billing('feature-list'), false],
  [orders('feature-list'), billing('state'), false],
  [orders('feature-list'), billing('api/bootstrap'), false],
  [orders('data'), billing('api/features'), false],
  [orders('data'), billing('api/notifications'), false],
  [orders('ui-card'), billing('api/new-capability'), false],
  [orders('api/new-capability'), billing('state'), false],
  [orders('api/new-capability'), orders('data'), false],
  [orders('ui-card'), billing('api/events'), false],
  [orders('ui-card'), billing('api/session'), false],
  [orders('util-format'), billing('api/contracts'), false],
  [orders('data'), orders('feature-list'), false],
  [orders('api/features'), billing('feature-list'), false],
  [orders('api/features'), billing('api/features'), false],
  [orders('api/contracts'), orders('feature-list'), false],
  [shared('data'), billing('api/contracts'), false],
  [shared('feature-list'), billing('api/features'), false],
  [shared('api/contracts'), billing('data'), false],
  [`${app}/shell`, billing('data'), false],
  [`${app}/shell`, billing('api/bootstrap'), false],
  [orders('feature-list'), `${app}/shell`, false],
  [orders('unknown-layer'), orders('data'), false],
  [orders('feature-list'), billing('api/new-capability'), true],
  [domain('future-domain-42', 'feature-list'), billing('api/features'), true],
];

beforeAll(() => {
  writeFileSync(
    join(fixture, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: {} }),
  );
  writeFileSync(
    join(fixture, 'sheriff.config.ts'),
    readFileSync('sheriff.config.ts'),
  );
  symlinkSync(
    resolve('../../node_modules'),
    join(fixture, 'node_modules'),
    'dir',
  );
  for (const module of new Set(cases.flatMap(([from, to]) => [from, to]))) {
    const folder = join(fixture, module);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'index.ts'), 'export const value = 1;');
  }
});

afterAll(() => rmSync(fixture, { recursive: true, force: true }));

describe('architecture: generic Sheriff domain and layer rules', () => {
  it.each(cases)('%s -> %s allowed=%s', (from, to, allowed) => {
    const file = join(fixture, from, 'consumer.ts');
    const target = join(fixture, to, 'index.ts');
    const rawImport = `./${relative(dirname(file), target).replace(/\.ts$/, '')}`;
    const content = `import { value } from '${rawImport}'; export { value };`;
    writeFileSync(file, content);
    const violation = violatesDependencyRule(file, rawImport, true, content);
    if (allowed) expect(violation).toBe('');
    else expect(violation).toContain('has no clearance');
  });

  it('classifies a future domain and API by their path, without root fallback', () => {
    const file = join(
      fixture,
      domain('future-domain-42', 'feature-list'),
      'consumer.ts',
    );
    writeFileSync(file, "export { value } from '../../billing/api/features';");
    const graph = getProjectData(file);
    expect(graph[file].tags).toEqual([
      'domain:future-domain-42',
      'type:feature',
    ]);
    expect(
      graph[join(fixture, billing('api/features'), 'index.ts')].tags,
    ).toEqual(['domain:billing/api', 'type:features-api']);
  });
  it('classifies an arbitrary capability without naming it in the config', () => {
    const file = join(
      fixture,
      orders('feature-list'),
      'capability-consumer.ts',
    );
    writeFileSync(
      file,
      "export { value } from '../../billing/api/new-capability';",
    );
    const graph = getProjectData(file);
    expect(
      graph[join(fixture, billing('api/new-capability'), 'index.ts')].tags,
    ).toEqual(['domain:billing/api', 'type:capability-api']);
  });
});
