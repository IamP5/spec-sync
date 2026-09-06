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
