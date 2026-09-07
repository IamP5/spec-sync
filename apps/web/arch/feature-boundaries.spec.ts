import { resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  boundaryViolations,
  normalizedFile,
  uiBehaviorViolations,
} from './feature-boundaries';
import type { Dependency } from './utils';

const root = process.cwd();
const config = ts.readConfigFile('tsconfig.arch.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const sources = program
  .getSourceFiles()
  .filter(
    (source) =>
      source.fileName.startsWith(resolve('src/app')) &&
      !source.fileName.endsWith('.spec.ts') &&
      !source.fileName.includes('/testing/'),
  );
const files = sources.map((source) => normalizedFile(source.fileName, root));
const dependencies: Dependency[] = [];
for (const source of sources) {
  const sourceName = normalizedFile(source.fileName, root);
  const collect = (module: ts.Expression): void => {
    if (!ts.isStringLiteral(module)) return;
    const resolved = ts.resolveModuleName(
      module.text,
      source.fileName,
      parsed.options,
      ts.sys,
    ).resolvedModule;
    if (resolved && !resolved.isExternalLibraryImport)
      dependencies.push({
        source: sourceName,
        target: normalizedFile(resolved.resolvedFileName, root),
      });
  };
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) collect(node.moduleSpecifier);
    if (ts.isExportDeclaration(node) && node.moduleSpecifier)
      collect(node.moduleSpecifier);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0]
    )
      collect(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(source);
}

describe('architecture: public features, pure UI and domain contracts', () => {
  it('keeps the application within its public boundaries', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(boundaryViolations(files, dependencies)).toEqual([]);
    expect(
      sources.flatMap((source) =>
        uiBehaviorViolations(normalizedFile(source.fileName, root), source),
      ),
    ).toEqual([]);
  });
  const catalog = 'src/app/domains/vehicles/feature-catalog';
  const comparison = 'src/app/domains/vehicles/feature-comparison';
  const chat = 'src/app/domains/chat/feature-chat';
  it('allows feature composition through entries and rejects private store imports', () => {
    const source = `${catalog}/catalog-overview.ts`;
    expect(
      boundaryViolations(
        [source],
        [{ source, target: `${comparison}/index.ts` }],
      ),
    ).toEqual([]);
    expect(
      boundaryViolations(
        [source],
        [{ source, target: `${comparison}/comparison-store.ts` }],
      ),
    ).toContain(
      `Private feature import: ${source} -> ${comparison}/comparison-store.ts`,
    );
  });
  it('rejects a smart filename and a colocated store under UI', () => {
    const source = `${catalog}/ui/catalog-overview.ts`;
    const target = `${catalog}/ui/catalog-store.ts`;
    expect(
      boundaryViolations([source, target], [{ source, target }]),
    ).toContain(`Application building block in UI: ${source}`);
    expect(
      boundaryViolations([source, target], [{ source, target }]),
    ).toContain(`UI reaches application workflow: ${source} -> ${target}`);
  });
  it('detects coordinator access hidden behind a helper', () => {
    const source = `${catalog}/ui/catalog-card.ts`;
    const helper = `${catalog}/helper.ts`;
    const target = `${catalog}/catalog-coordinator.ts`;
    expect(
      boundaryViolations(
        [source],
        [
          { source, target: helper },
          { source: helper, target },
        ],
      ),
    ).toContain(`UI reaches application workflow: ${source} -> ${target}`);
  });
  it('rejects cycles through public entries', () => {
    const deps = [
      {
        source: `${catalog}/index.ts`,
        target: `${catalog}/catalog-overview.ts`,
      },
      {
        source: `${catalog}/catalog-overview.ts`,
        target: `${comparison}/index.ts`,
      },
      {
        source: `${comparison}/index.ts`,
        target: `${comparison}/comparison-overview.ts`,
      },
      {
        source: `${comparison}/comparison-overview.ts`,
        target: `${catalog}/index.ts`,
      },
    ];
    expect(boundaryViolations([], deps)).toContain(
      `Feature dependency cycle: ${catalog}`,
    );
  });
  it('permits chat contract consumers but rejects domain internals and feature APIs in data', () => {
    const source = 'src/app/domains/chat/data/chat-agent-client.ts';
    const contracts = 'src/app/domains/vehicles/api/contracts/index.ts';
    expect(boundaryViolations([], [{ source, target: contracts }])).toEqual([]);
    for (const target of [
      'src/app/domains/vehicles/data/vehicle-contracts.ts',
      'src/app/domains/vehicles/api/features/index.ts',
    ]) {
      expect(boundaryViolations([], [{ source, target }])).toContain(
        `Domain boundary: ${source} -> ${target}`,
      );
    }
    expect(
      boundaryViolations(
        [],
        [
          {
            source: `${catalog}/catalog-overview.ts`,
            target: `${chat}/index.ts`,
          },
        ],
      ),
    ).not.toEqual([]);
  });
  it('prevents contracts from laundering workflow dependencies', () => {
    const source = 'src/app/domains/vehicles/api/contracts/index.ts';
    const helper = 'src/app/domains/vehicles/data/models.ts';
    const target = `${catalog}/index.ts`;
    expect(
      boundaryViolations(
        [source],
        [
          { source, target: helper },
          { source: helper, target },
        ],
      ),
    ).toContain(
      `Contract API reaches application workflow: ${source} -> ${target}`,
    );
  });
  it('allows public composition and capabilities while protecting private state', () => {
    const user = 'src/app/domains/user/feature-user/user-account-overview.ts';
    const auth = 'src/app/domains/auth/api/features/index.ts';
    const preferences = 'src/app/domains/user/api/preferences/index.ts';
    expect(boundaryViolations([], [{ source: user, target: auth }])).toEqual(
      [],
    );
    expect(
      boundaryViolations(
        [],
        [{ source: `${chat}/chat-page.ts`, target: preferences }],
      ),
    ).toEqual([]);
    for (const source of [
      user,
      `${chat}/chat-page.ts`,
      'src/app/app-coordinator.ts',
    ]) {
      const target = 'src/app/domains/user/state/preferences-detail-store.ts';
      expect(boundaryViolations([], [{ source, target }])).toContain(
        `Private domain state import: ${source} -> ${target}`,
      );
    }
    expect(
      boundaryViolations(
        [],
        [
          {
            source: 'src/app/domains/auth/data/auth-client.ts',
            target: preferences,
          },
        ],
      ),
    ).not.toEqual([]);
    expect(
      boundaryViolations(
        [],
        [{ source: `${chat}/data/chat-client.ts`, target: preferences }],
      ),
    ).not.toEqual([]);
  });
  it('enforces shell composition and credential-free auth APIs', () => {
    const shell = 'src/app/shell/sidebar/sidebar-overview.ts';
    const store = 'src/app/domains/user/state/preferences-detail-store.ts';
    const authStore = 'src/app/domains/auth/state/auth-session-store.ts';
    const eventApi = 'src/app/domains/auth/api/events/index.ts';
    expect(
      boundaryViolations([], [{ source: store, target: eventApi }]),
    ).toEqual([]);
    expect(
      boundaryViolations(
        [],
        [
          {
            source: shell,
            target: 'src/app/domains/user/api/features/index.ts',
          },
        ],
      ),
    ).toEqual([]);
    expect(
      boundaryViolations([], [{ source: shell, target: store }]),
    ).not.toEqual([]);
    expect(
      boundaryViolations([], [{ source: shell, target: authStore }]),
    ).not.toEqual([]);
    expect(
      boundaryViolations([], [{ source: store, target: shell }]),
    ).not.toEqual([]);
    expect(
      boundaryViolations(
        [],
        [
          {
            source: 'src/app/domains/shared/util-config/index.ts',
            target: eventApi,
          },
        ],
      ),
    ).not.toEqual([]);
    expect(
      boundaryViolations(
        [],
        [
          {
            source: 'src/app/domains/chat/feature-chat/ui/chat-card.ts',
            target: eventApi,
          },
        ],
      ),
    ).not.toEqual([]);
  });
  it.each(['orders', 'billing', 'future-domain-42'])(
    'protects private state and capability exports for %s',
    (name) => {
      const root = `src/app/domains/${name}`;
      const coordinator = `${root}/state/summary-coordinator.ts`;
      const store = `${root}/state/summary-detail-store.ts`;
      const capability = `${root}/api/notifications/index.ts`;
      expect(
        boundaryViolations([], [{ source: capability, target: coordinator }]),
      ).toEqual([]);
      expect(
        boundaryViolations([], [{ source: coordinator, target: store }]),
      ).toEqual([]);
      for (const source of [
        `${root}/feature-list/list-page.ts`,
        'src/app/app.providers.ts',
        'src/app/shell/sidebar/sidebar-overview.ts',
        'src/app/domains/another/state/summary-coordinator.ts',
      ]) {
        expect(boundaryViolations([], [{ source, target: store }])).toContain(
          `Private domain state import: ${source} -> ${store}`,
        );
      }
      expect(
        boundaryViolations([], [{ source: capability, target: store }]),
      ).toContain(
        `Capability API must expose its coordinators: ${capability} -> ${store}`,
      );
      const foreign = 'src/app/domains/another/state/summary-coordinator.ts';
      expect(
        boundaryViolations([], [{ source: capability, target: foreign }]),
      ).toContain(`API imports another domain: ${capability} -> ${foreign}`);
    },
  );
  it('requires public entries for new domains even from root composition', () => {
    const source = 'src/app/app.providers.ts';
    const root = 'src/app/domains/future-domain-42';
    expect(
      boundaryViolations(
        [],
        [{ source, target: `${root}/api/bootstrap/index.ts` }],
      ),
    ).toEqual([]);
    for (const target of [
      `${root}/data/settings.ts`,
      `${root}/api/bootstrap/private-helper.ts`,
    ]) {
      expect(boundaryViolations([], [{ source, target }])).toContain(
        `Composition imports domain internals: ${source} -> ${target}`,
      );
    }
  });
  it('rejects unclassified domain code even when nothing imports it', () => {
    for (const file of [
      'src/app/domains/future-domain-42/orphan.ts',
      'src/app/domains/future-domain-42/unknown-layer/helper.ts',
      'src/app/domains/future-domain-42/api/notifications/private-helper.ts',
    ]) {
      expect(boundaryViolations([file], [])).toContain(
        `Unclassified domain file: ${file}`,
      );
    }
  });
  it('detects cross-domain feature cycles through typed public APIs', () => {
    const first = 'src/app/domains/orders';
    const second = 'src/app/domains/billing';
    const deps = [
      {
        source: `${first}/feature-list/list-page.ts`,
        target: `${second}/api/features/index.ts`,
      },
      {
        source: `${second}/api/features/index.ts`,
        target: `${second}/feature-list/index.ts`,
      },
      {
        source: `${second}/feature-list/index.ts`,
        target: `${second}/feature-list/list-page.ts`,
      },
      {
        source: `${second}/feature-list/list-page.ts`,
        target: `${first}/api/features/index.ts`,
      },
      {
        source: `${first}/api/features/index.ts`,
        target: `${first}/feature-list/index.ts`,
      },
      {
        source: `${first}/feature-list/index.ts`,
        target: `${first}/feature-list/list-page.ts`,
      },
    ];
    expect(boundaryViolations([], deps)).toContain(
      `Feature dependency cycle: ${first}/feature-list`,
    );
  });
  it('recognizes aliased form factories and application injections in UI', () => {
    const file = `${catalog}/ui/catalog-card.ts`;
    const source = ts.createSourceFile(
      file,
      `import { form as makeForm } from '@angular/forms/signals'; import { inject } from '@angular/core'; import { ACTIONS } from '../actions'; import { OTHER_ACTIONS } from '@app/actions'; makeForm(model); inject(ACTIONS); inject(OTHER_ACTIONS);`,
      ts.ScriptTarget.Latest,
    );
    expect(uiBehaviorViolations(file, source)).toEqual([
      `UI owns a form: ${file}`,
      `UI injects application dependency: ${file}`,
      `UI injects application dependency: ${file}`,
    ]);
  });
});
