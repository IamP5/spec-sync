import { posix } from 'node:path';

import ts from 'typescript';

import type { Dependency } from './utils';

// A port of apps/web/arch/feature-boundaries.ts. The graph rules are the
// same; the React checks at the bottom replace the web's Angular `inject()`
// and Signal Forms checks.

const DOMAIN = /(?:^|\/)domains\/([^/]+)\//;
const FEATURE = /((?:^|.*\/)domains\/[^/]+\/feature-[^/]+)(?:\/|$)/;
const UI = /(?:^|\/)ui(?:-[^/]+)?\//;
const DUMB_SUFFIX = /-(card|pane)\.tsx$/;
const SMART = /-(screen|search|edit|detail|overview)\.tsx$/;
const STATE = /-(store|client|coordinator)\.tsx?$/;
const DOMAIN_STATE = /((?:^|.*\/)domains\/[^/]+\/state)\//;
const LAYER =
  /(?:^|\/)domains\/[^/]+\/(feature-[^/]+|ui(?:-[^/]+)?|data(?:-[^/]+)?|util(?:-[^/]+)?|state|session|transport)\//;
const API = /\/domains\/[^/]+\/api\/([^/]+)\/index\.tsx?$/;
const SHELL = /(?:^|\/)shell\//;
const ROUTES = /(?:^|\/)src\/app\//;
const FEATURE_ENTRY = (owner: string) =>
  new Set([`${owner}/index.ts`, `${owner}/index.tsx`]);
const TECHNICAL_APIS = new Set([
  'contracts',
  'features',
  'events',
  'session',
  'bootstrap',
]);

function isCapabilityApi(file: string): boolean {
  const name = file.match(API)?.[1];
  return name !== undefined && !TECHNICAL_APIS.has(name);
}

function feature(file: string): string | undefined {
  return file.match(FEATURE)?.[1];
}
function domain(file: string): string | undefined {
  return file.match(DOMAIN)?.[1];
}
function isUi(file: string): boolean {
  return UI.test(file) || DUMB_SUFFIX.test(file);
}
function isFeatureEntry(file: string): boolean {
  const owner = feature(file);
  return !!owner && FEATURE_ENTRY(owner).has(file);
}

/** Checks direct boundaries and transitive contracts/UI access, including barrel exports. */
export function boundaryViolations(
  files: readonly string[],
  dependencies: readonly Dependency[],
): string[] {
  const violations: string[] = [];
  const adjacency = new Map<string, string[]>();
  for (const { source, target } of dependencies) {
    adjacency.set(source, [...(adjacency.get(source) ?? []), target]);
    const owner = feature(target);
    if (owner && feature(source) !== owner && !isFeatureEntry(target)) {
      violations.push(`Private feature import: ${source} -> ${target}`);
    }
    const stateOwner = target.match(DOMAIN_STATE)?.[1];
    const ownCapabilityEntry =
      domain(source) === domain(target) &&
      isCapabilityApi(source) &&
      /-coordinator\.tsx?$/.test(target);
    if (
      stateOwner &&
      source.match(DOMAIN_STATE)?.[1] !== stateOwner &&
      !ownCapabilityEntry
    ) {
      violations.push(`Private domain state import: ${source} -> ${target}`);
    }
    if (domain(source) && SHELL.test(target))
      violations.push(`Domain imports shell: ${source} -> ${target}`);
    if (
      SHELL.test(source) &&
      domain(target) &&
      domain(target) !== 'shared' &&
      !API.test(target)
    )
      violations.push(`Shell imports domain internals: ${source} -> ${target}`);
    if (
      domain(source) === 'shared' &&
      domain(target) &&
      domain(target) !== 'shared'
    )
      violations.push(`Shared imports a domain: ${source} -> ${target}`);
    if (
      !domain(source) &&
      !SHELL.test(source) &&
      domain(target) &&
      domain(target) !== 'shared' &&
      !API.test(target)
    )
      violations.push(
        `Composition imports domain internals: ${source} -> ${target}`,
      );
    if (!ROUTES.test(source) && ROUTES.test(target))
      violations.push(`Route imported by app code: ${source} -> ${target}`);
    const from = domain(source);
    const to = domain(target);
    if (from && to && from !== to && to !== 'shared') {
      const api = target.match(API)?.[1];
      const layer = source.match(LAYER)?.[1];
      const allowedLayer =
        api === 'events' || api === 'session'
          ? !!layer && !layer.startsWith('util') && !isUi(source)
          : api === 'contracts'
            ? !!layer && /^(feature-|data|ui)/.test(layer)
            : api === 'features'
              ? !!feature(source) && !isUi(source)
              : isCapabilityApi(target) &&
                !!feature(source) &&
                !isUi(source) &&
                (SMART.test(source) || /-coordinator\.tsx?$/.test(source));
      if (!allowedLayer)
        violations.push(`Domain boundary: ${source} -> ${target}`);
    }
    if (
      domain(source) &&
      /\/api\//.test(source) &&
      domain(target) &&
      domain(target) !== domain(source) &&
      domain(target) !== 'shared'
    ) {
      violations.push(`API imports another domain: ${source} -> ${target}`);
    }
    if (isCapabilityApi(source) && (!stateOwner || !ownCapabilityEntry)) {
      violations.push(
        `Capability API must expose its coordinators: ${source} -> ${target}`,
      );
    }
    if (
      /\/api\/features\//.test(source) &&
      (!owner || !isFeatureEntry(target))
    ) {
      violations.push(
        `Feature API must export feature entries: ${source} -> ${target}`,
      );
    }
    if (
      isFeatureEntry(source) &&
      (!SMART.test(target) || feature(target) !== feature(source))
    ) {
      violations.push(
        `Feature entry must export its smart components: ${source} -> ${target}`,
      );
    }
  }
  for (const file of files) {
    if (domain(file) && !LAYER.test(file) && !API.test(file))
      violations.push(`Unclassified domain file: ${file}`);
    if (UI.test(file) && (STATE.test(file) || SMART.test(file)))
      violations.push(`Application building block in UI: ${file}`);
    if (isUi(file)) {
      for (const target of reachable(file, adjacency)) {
        if (
          STATE.test(target) ||
          SMART.test(target) ||
          /\/api\/features\//.test(target)
        ) {
          violations.push(
            `UI reaches application workflow: ${file} -> ${target}`,
          );
        }
      }
    }
    if (/\/api\/contracts\//.test(file)) {
      for (const target of reachable(file, adjacency)) {
        if (
          STATE.test(target) ||
          feature(target) ||
          UI.test(target) ||
          /\/api\/features\//.test(target)
        ) {
          violations.push(
            `Contract API reaches application workflow: ${file} -> ${target}`,
          );
        }
      }
    }
  }
  const featureEdges = new Map<string, Set<string>>();
  for (const { source, target } of dependencies) {
    const owner = feature(source);
    if (!owner) continue;
    const targets = [
      target,
      ...reachable(target, adjacency, (file) => !!feature(file)),
    ];
    for (const destination of targets.map(feature)) {
      if (destination && destination !== owner) {
        const edges = featureEdges.get(owner) ?? new Set<string>();
        edges.add(destination);
        featureEdges.set(owner, edges);
      }
    }
  }
  for (const owner of featureEdges.keys()) {
    const graph = new Map(
      [...featureEdges].map(([key, values]) => [key, [...values]]),
    );
    if (reachable(owner, graph).has(owner))
      violations.push(`Feature dependency cycle: ${owner}`);
  }
  return [...new Set(violations)].sort();
}

function reachable(
  start: string,
  graph: ReadonlyMap<string, readonly string[]>,
  stop?: (file: string) => boolean,
): Set<string> {
  const visited = new Set<string>();
  const queue = [...(graph.get(start) ?? [])];
  while (queue.length) {
    const next = queue.pop();
    if (!next || visited.has(next)) continue;
    visited.add(next);
    if (!stop?.(next)) queue.push(...(graph.get(next) ?? []));
  }
  return visited;
}

/** Value imports of a file: module name and the imported (not local) names. */
function valueImports(
  source: ts.SourceFile,
): { module: string; names: string[] }[] {
  const imports: { module: string; names: string[] }[] = [];
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.importClause?.isTypeOnly
    )
      continue;
    const names: string[] = [];
    const clause = statement.importClause;
    if (clause?.name) names.push('default');
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) names.push('*');
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements)
        if (!element.isTypeOnly)
          names.push(element.propertyName?.text ?? element.name.text);
    }
    imports.push({ module: statement.moduleSpecifier.text, names });
  }
  return imports;
}

// Application machinery that dumb UI must not touch, whatever the import is
// renamed to: server and client state, forms, the chat runtime, storage.
const APPLICATION_MODULES = [
  /^@tanstack\/react-query/,
  /^zustand/,
  /^react-hook-form$/,
  /^@copilotkit\//,
  /^@ag-ui\//,
  /^expo-secure-store$/,
  /^expo-sqlite/,
];
// Navigation belongs to smart screens. UI may render a `Link` whose href it
// received as a prop, but never drives the router.
const ROUTER_MODULE = /^expo-router(\/.*)?$/;
const ROUTER_UI_EXPORTS = new Set(['Link']);

/** A renamed import must not hide state, forms, the chat runtime or navigation inside UI. */
export function uiBehaviorViolations(
  file: string,
  source: ts.SourceFile,
): string[] {
  if (!isUi(file)) return [];
  const errors: string[] = [];
  for (const { module, names } of valueImports(source)) {
    if (APPLICATION_MODULES.some((pattern) => pattern.test(module)))
      errors.push(`UI uses application machinery: ${file} -> ${module}`);
    if (
      ROUTER_MODULE.test(module) &&
      names.some((name) => !ROUTER_UI_EXPORTS.has(name))
    )
      errors.push(`UI navigates: ${file} -> ${module}`);
  }
  return errors;
}

// Where the chat runtime and the query cache may be touched: stores and
// coordinators (the application layer), transport (runtime providers), and
// the shared query client. Everything else reaches them through a store.
const RUNTIME_MODULES = [/^@copilotkit\//, /^@tanstack\/react-query/];
const RUNTIME_OWNERS = [
  /-(store|coordinator)\.tsx?$/,
  /\/domains\/[^/]+\/transport\//,
  /\/domains\/shared\/util-query\//,
  ROUTES,
];

/** Components never talk to the chat runtime or the query cache directly. */
export function runtimeAccessViolations(
  file: string,
  source: ts.SourceFile,
): string[] {
  if (RUNTIME_OWNERS.some((owner) => owner.test(file))) return [];
  return valueImports(source)
    .filter(({ module }) =>
      RUNTIME_MODULES.some((pattern) => pattern.test(module)),
    )
    .map(
      ({ module }) => `Runtime access outside a store: ${file} -> ${module}`,
    );
}

// Expo Router treats every file under src/app as a route, so the folder holds
// routes and layouts only (expo-router, expo-project-structure).
const ROUTE_EXPORTS = new Set([
  'default',
  'ErrorBoundary',
  'unstable_settings',
]);

/** Every file under src/app is a route: a default export and nothing else of its own. */
export function routeFileViolations(
  file: string,
  source: ts.SourceFile,
): string[] {
  if (!ROUTES.test(file)) return [];
  if (!file.endsWith('.tsx'))
    return [`Route folder holds a non-route file: ${file}`];
  const exported = new Set<string>();
  for (const statement of source.statements) {
    const modifiers = ts.canHaveModifiers(statement)
      ? ts.getModifiers(statement)
      : undefined;
    const isExport = modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    const isDefault = modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
    );
    if (ts.isExportAssignment(statement)) exported.add('default');
    else if (isExport && isDefault) exported.add('default');
    else if (isExport && ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name))
          exported.add(declaration.name.text);
    } else if (
      isExport &&
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))
    )
      exported.add(statement.name?.text ?? 'default');
    else if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements)
        exported.add(element.name.text);
    }
  }
  const errors: string[] = [];
  if (!exported.has('default'))
    errors.push(`Route without a default export: ${file}`);
  for (const name of exported)
    if (!ROUTE_EXPORTS.has(name)) errors.push(`Route exports ${name}: ${file}`);
  return errors;
}

export function normalizedFile(file: string, root: string): string {
  return posix.normalize(
    file.replaceAll('\\', '/').replace(`${root.replaceAll('\\', '/')}/`, ''),
  );
}
