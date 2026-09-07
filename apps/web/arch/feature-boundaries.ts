import { posix } from 'node:path';

import ts from 'typescript';

import type { Dependency } from './utils';

const DOMAIN = /(?:^|\/)domains\/([^/]+)\//;
const FEATURE = /((?:^|.*\/)domains\/[^/]+\/feature-[^/]+)(?:\/|$)/;
const UI = /(?:^|\/)ui(?:-[^/]+)?\//;
const SMART = /-(page|search|edit|detail|overview)\.ts$/;
const STATE = /-(store|client|coordinator)\.ts$/;
const DOMAIN_STATE = /((?:^|.*\/)domains\/[^/]+\/state)\//;
const LAYER =
  /(?:^|\/)domains\/[^/]+\/(feature-[^/]+|ui(?:-[^/]+)?|data(?:-[^/]+)?|util(?:-[^/]+)?|state|session|transport)\//;
const API = /\/domains\/[^/]+\/api\/([^/]+)\/index\.ts$/;
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
  return UI.test(file) || /-(card|pane)\.ts$/.test(file);
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
    if (owner && feature(source) !== owner && target !== `${owner}/index.ts`) {
      violations.push(`Private feature import: ${source} -> ${target}`);
    }
    const stateOwner = target.match(DOMAIN_STATE)?.[1];
    const ownCapabilityEntry =
      domain(source) === domain(target) &&
      isCapabilityApi(source) &&
      target.endsWith('-coordinator.ts');
    if (
      stateOwner &&
      source.match(DOMAIN_STATE)?.[1] !== stateOwner &&
      !ownCapabilityEntry
    ) {
      violations.push(`Private domain state import: ${source} -> ${target}`);
    }
    if (domain(source) && /\/shell\//.test(target))
      violations.push(`Domain imports shell: ${source} -> ${target}`);
    if (
      /\/shell\//.test(source) &&
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
      !/\/shell\//.test(source) &&
      domain(target) &&
      domain(target) !== 'shared' &&
      !API.test(target)
    )
      violations.push(
        `Composition imports domain internals: ${source} -> ${target}`,
      );
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
                (SMART.test(source) || source.endsWith('-coordinator.ts'));
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
      (!owner || target !== `${owner}/index.ts`)
    ) {
      violations.push(
        `Feature API must export feature entries: ${source} -> ${target}`,
      );
    }
    if (
      feature(source) &&
      source === `${feature(source)}/index.ts` &&
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

/** A renamed import must not hide a form owner or application injection inside UI. */
export function uiBehaviorViolations(
  file: string,
  source: ts.SourceFile,
): string[] {
  if (!isUi(file)) return [];
  const imports = new Map<string, { name: string; module: string }>();
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements)
        imports.set(element.name.text, {
          name: element.propertyName?.text ?? element.name.text,
          module: statement.moduleSpecifier.text,
        });
    }
  }
  const errors: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const imported = imports.get(node.expression.text);
      if (
        imported?.module === '@angular/forms/signals' &&
        imported.name === 'form'
      )
        errors.push(`UI owns a form: ${file}`);
      if (imported?.module === '@angular/core' && imported.name === 'inject') {
        const token = node.arguments[0];
        const origin =
          token && ts.isIdentifier(token)
            ? imports.get(token.text)?.module
            : undefined;
        const technicalDependency =
          origin === '@angular/core' ||
          origin === '@angular/common' ||
          origin?.startsWith('@angular/cdk/') ||
          origin?.startsWith('@/ui/');
        if (!technicalDependency)
          errors.push(`UI injects application dependency: ${file}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return errors;
}

export function normalizedFile(file: string, root: string): string {
  return posix.normalize(
    file.replaceAll('\\', '/').replace(`${root.replaceAll('\\', '/')}/`, ''),
  );
}
