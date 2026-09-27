import { filesOfProject } from 'tsarch';
import { describe, expect, it } from 'vitest';

import { anyFileExcept, formatDependency, toDependency } from './utils';

// Building blocks are recognised by file-name suffixes. The rules below are
// documented in apps/mobile/docs/architecture-boundaries.md ("Layers and
// building blocks") and apps/mobile/docs/architecture-state-management.md.
const TS_CONFIG = 'tsconfig.arch.json';

const STORE = String.raw`-store\.tsx?$`;
const CLIENT = String.raw`-client\.tsx?$`;
const SMART = String.raw`-(screen|search|edit|detail|overview)\.tsx$`;
const DUMB = String.raw`(-(card|pane)\.tsx$|/ui(-[^/]+)?/)`;
const COORDINATOR = String.raw`-coordinator\.tsx?$`;

describe('architecture: suffix-based access rules', () => {
  it('only stores may access data access (clients)', async () => {
    const rule = filesOfProject(TS_CONFIG)
      .matchingPattern(anyFileExcept(STORE))
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(CLIENT);

    const violations = await rule.check();
    expect(violations.map(toDependency).map(formatDependency)).toEqual([]);
  });

  it('only smart screens and coordinators may access a store', async () => {
    // Coordinators are hooks that combine several stores.
    const rule = filesOfProject(TS_CONFIG)
      .matchingPattern(anyFileExcept(SMART, STORE, COORDINATOR))
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(STORE);

    const violations = (await rule.check()).map(toDependency);

    expect(violations.map(formatDependency)).toEqual([]);
  });

  it('dumb components cannot access stores or coordinators, regardless of suffix', async () => {
    const violations = await filesOfProject(TS_CONFIG)
      .matchingPattern(DUMB)
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(String.raw`-(store|coordinator)\.tsx?$`)
      .check();
    expect(violations.map(toDependency).map(formatDependency)).toEqual([]);
  });

  it('stores must not access other stores', async () => {
    // Combining several stores is the job of a coordinator, not of a store.
    const rule = filesOfProject(TS_CONFIG)
      .matchingPattern(STORE)
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(STORE);

    const violations = await rule.check();
    expect(violations.map(toDependency).map(formatDependency)).toEqual([]);
  });

  it('dumb components must not access smart components', async () => {
    const rule = filesOfProject(TS_CONFIG)
      .matchingPattern(DUMB)
      .shouldNot()
      .dependOnFiles()
      .matchingPattern(SMART);

    const violations = await rule.check();
    expect(violations.map(toDependency).map(formatDependency)).toEqual([]);
  });
});
