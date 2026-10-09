import { resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  boundaryViolations,
  normalizedFile,
  routeFileViolations,
  runtimeAccessViolations,
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
      source.fileName.startsWith(resolve('src')) &&
      !/\.spec\.tsx?$/.test(source.fileName) &&
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

const parse = (file: string, code: string) =>
  ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

describe('architecture: public features, pure UI and domain contracts', () => {
  it('keeps the application within its public boundaries', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(boundaryViolations(files, dependencies)).toEqual([]);
    for (const check of [
      uiBehaviorViolations,
      runtimeAccessViolations,
      routeFileViolations,
    ])
      expect(
        sources.flatMap((source) =>
          check(normalizedFile(source.fileName, root), source),
        ),
      ).toEqual([]);
  });

  const catalog = 'src/domains/vehicles/feature-catalog';
  const comparison = 'src/domains/vehicles/feature-comparison';
  const chat = 'src/domains/chat/feature-chat';

  it('allows feature composition through entries and rejects private imports', () => {
    const source = `${catalog}/catalog-screen.tsx`;
    expect(
      boundaryViolations(
        [source],
        [{ source, target: `${comparison}/index.ts` }],
      ),
    ).toEqual([]);
    const target = `${comparison}/comparison-store.ts`;
    expect(boundaryViolations([source], [{ source, target }])).toContain(
      `Private feature import: ${source} -> ${target}`,
    );
  });

  it('routes compose public entries only', () => {
    const source = 'src/app/(catalog)/index.tsx';
    const future = 'src/domains/future-domain-42';
    expect(
      boundaryViolations(
        [source],
        [
          { source, target: `${future}/api/features/index.ts` },
          { source, target: `${future}/api/bootstrap/index.ts` },
          { source, target: 'src/design-system/components/ui/text.tsx' },
        ],
      ),
    ).toEqual([]);
    for (const target of [
      `${future}/feature-list/list-screen.tsx`,
      `${future}/data/list-client.ts`,
    ])
      expect(boundaryViolations([source], [{ source, target }])).toContain(
        `Composition imports domain internals: ${source} -> ${target}`,
      );
    const screen = `${catalog}/catalog-screen.tsx`;
    expect(
      boundaryViolations([screen], [{ source: screen, target: source }]),
    ).toContain(`Route imported by app code: ${screen} -> ${source}`);
  });

  it('keeps UI away from workflows, even transitively', () => {
    const ui = `${chat}/ui/message-list.tsx`;
    const helper = `${chat}/ui/list-helper.ts`;
    const store = `${chat}/chat-conversation-store.ts`;
    expect(
      boundaryViolations(
        [ui, helper],
        [
          { source: ui, target: helper },
          { source: helper, target: store },
        ],
      ),
    ).toContain(`UI reaches application workflow: ${ui} -> ${store}`);
  });

  it('crosses domains through typed APIs from the permitted layers', () => {
    const data = 'src/domains/orders/data/orders-client.ts';
    const contracts = 'src/domains/billing/api/contracts/index.ts';
    const features = 'src/domains/billing/api/features/index.ts';
    expect(
      boundaryViolations([], [{ source: data, target: contracts }]),
    ).toEqual([]);
    expect(
      boundaryViolations([], [{ source: data, target: features }]),
    ).toContain(`Domain boundary: ${data} -> ${features}`);
  });

  it('rejects unclassified domain code even when nothing imports it', () => {
    for (const file of [
      'src/domains/future-domain-42/orphan.ts',
      'src/domains/future-domain-42/unknown-layer/helper.ts',
      'src/domains/future-domain-42/api/notifications/private-helper.ts',
    ])
      expect(boundaryViolations([file], [])).toContain(
        `Unclassified domain file: ${file}`,
      );
  });

  it('detects cross-domain feature cycles through typed public APIs', () => {
    const first = 'src/domains/orders';
    const second = 'src/domains/billing';
    const deps = [
      {
        source: `${first}/feature-list/list-screen.tsx`,
        target: `${second}/api/features/index.ts`,
      },
      {
        source: `${second}/api/features/index.ts`,
        target: `${second}/feature-list/index.ts`,
      },
      {
        source: `${second}/feature-list/index.ts`,
        target: `${second}/feature-list/list-screen.tsx`,
      },
      {
        source: `${second}/feature-list/list-screen.tsx`,
        target: `${first}/api/features/index.ts`,
      },
      {
        source: `${first}/api/features/index.ts`,
        target: `${first}/feature-list/index.ts`,
      },
      {
        source: `${first}/feature-list/index.ts`,
        target: `${first}/feature-list/list-screen.tsx`,
      },
    ];
    expect(boundaryViolations([], deps)).toContain(
      `Feature dependency cycle: ${first}/feature-list`,
    );
  });

  it('recognizes renamed state, form, runtime and router imports in UI', () => {
    const file = `${catalog}/ui/catalog-card.tsx`;
    const source = parse(
      file,
      `import { useQuery as q } from '@tanstack/react-query';
       import { useForm as f } from 'react-hook-form';
       import { useAgent } from '@copilotkit/react-native/headless';
       import { Link, useRouter as r } from 'expo-router';
       import type { Message } from '@ag-ui/client';`,
    );
    expect(uiBehaviorViolations(file, source)).toEqual([
      `UI uses application machinery: ${file} -> @tanstack/react-query`,
      `UI uses application machinery: ${file} -> react-hook-form`,
      `UI uses application machinery: ${file} -> @copilotkit/react-native/headless`,
      `UI navigates: ${file} -> expo-router`,
    ]);
    const link = parse(file, `import { Link } from 'expo-router';`);
    expect(uiBehaviorViolations(file, link)).toEqual([]);
  });

  it('keeps the chat runtime and the query cache inside stores', () => {
    const screen = `${chat}/chat-screen.tsx`;
    const code = `import { useAgent } from '@copilotkit/react-native/headless';`;
    expect(runtimeAccessViolations(screen, parse(screen, code))).toEqual([
      `Runtime access outside a store: ${screen} -> @copilotkit/react-native/headless`,
    ]);
    const store = `${chat}/chat-conversation-store.ts`;
    expect(runtimeAccessViolations(store, parse(store, code))).toEqual([]);
  });

  it('keeps src/app routes-only', () => {
    const route = 'src/app/(catalog)/index.tsx';
    expect(
      routeFileViolations(
        route,
        parse(
          route,
          `export { ErrorBoundary } from 'expo-router'; export default function Route() { return null; }`,
        ),
      ),
    ).toEqual([]);
    expect(
      routeFileViolations(
        route,
        parse(route, `export const helper = 1; export function Other() {}`),
      ),
    ).toEqual([
      `Route without a default export: ${route}`,
      `Route exports helper: ${route}`,
      `Route exports Other: ${route}`,
    ]);
    const util = 'src/app/format.ts';
    expect(routeFileViolations(util, parse(util, ''))).toEqual([
      `Route folder holds a non-route file: ${util}`,
    ]);
  });
});
