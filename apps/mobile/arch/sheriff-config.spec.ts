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

// Run the actual Sheriff parser and matcher against the workspace root
// config, which merges the web and mobile rules. The fixture's node_modules
// links to the real one, so the root stub resolves both apps' rules through
// their workspace links. These domains deliberately do not exist.
const fixture = mkdtempSync(join(tmpdir(), 'specsync-mobile-sheriff-'));
const src = 'apps/mobile/src';
const domain = (name: string, layer: string) =>
  `${src}/domains/${name}/${layer}`;
const orders = (layer: string) => domain('orders', layer);
const billing = (layer: string) => domain('billing', layer);
const shared = (layer: string) => domain('shared', layer);
const routes = `${src}/app`;
const designSystem = `${src}/design-system`;
const webOrders = (layer: string) => `apps/web/src/app/domains/orders/${layer}`;

const cases: [string, string, boolean][] = [
  [orders('feature-list'), orders('data'), true],
  [orders('feature-list'), orders('feature-edit'), true],
  [orders('feature-list'), billing('api/features'), true],
  [orders('feature-list'), billing('api/notifications'), true],
  [orders('feature-list'), billing('api/contracts'), true],
  [orders('feature-list'), billing('api/session'), true],
  [orders('feature-list'), designSystem, true],
  [orders('ui'), designSystem, true],
  [orders('state'), billing('api/events'), true],
  [orders('data'), billing('api/session'), true],
  [orders('data'), billing('api/contracts'), true],
  [orders('ui-card'), billing('api/contracts'), true],
  [orders('data'), shared('util-format'), true],
  [orders('transport'), shared('util-config'), true],
  [orders('api/features'), orders('feature-list'), true],
  [orders('api/notifications'), orders('state'), true],
  [orders('api/bootstrap'), orders('transport'), true],
  [`${src}/shell`, billing('api/features'), true],
  [routes, billing('api/features'), true],
  [routes, billing('api/bootstrap'), true],
  [routes, designSystem, true],
  [routes, shared('util-query'), true],
  [routes, `${src}/shell`, true],
  [orders('feature-list'), billing('data'), false],
  [orders('feature-list'), billing('feature-list'), false],
  [orders('feature-list'), billing('state'), false],
  [orders('feature-list'), billing('api/bootstrap'), false],
  [orders('data'), billing('api/features'), false],
  [orders('data'), designSystem, false],
  [orders('util'), designSystem, false],
  [orders('ui-card'), billing('api/new-capability'), false],
  [orders('ui-card'), billing('api/events'), false],
  [orders('util-format'), billing('api/contracts'), false],
  [orders('data'), orders('feature-list'), false],
  [orders('api/features'), billing('feature-list'), false],
  [orders('api/contracts'), orders('feature-list'), false],
  [shared('data'), billing('api/contracts'), false],
  [designSystem, orders('data'), false],
  [`${src}/shell`, billing('data'), false],
  [`${src}/shell`, billing('api/bootstrap'), false],
  [orders('feature-list'), `${src}/shell`, false],
  [orders('unknown-layer'), orders('data'), false],
  [routes, billing('feature-list'), false],
  [routes, billing('data'), false],
  [routes, billing('state'), false],
  // The two apps never see each other, even for a domain name they share.
  [orders('feature-list'), webOrders('data'), false],
  [orders('feature-list'), webOrders('api/features'), false],
  [webOrders('feature-list'), orders('api/features'), false],
  [domain('future-domain-42', 'feature-list'), billing('api/features'), true],
];

beforeAll(() => {
  writeFileSync(
    join(fixture, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: {} }),
  );
  writeFileSync(
    join(fixture, 'sheriff.config.ts'),
    readFileSync(resolve('../../sheriff.config.ts')),
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

  it('classifies a future domain and API by their path, with mobile tags', () => {
    const file = join(
      fixture,
      domain('future-domain-42', 'feature-list'),
      'consumer.ts',
    );
    writeFileSync(file, "export { value } from '../../billing/api/features';");
    const graph = getProjectData(file);
    expect(graph[file]?.tags).toEqual([
      'mobile:domain:future-domain-42',
      'mobile:type:feature',
    ]);
    expect(
      graph[join(fixture, billing('api/features'), 'index.ts')]?.tags,
    ).toEqual(['mobile:domain:billing/api', 'mobile:type:features-api']);
  });
});
