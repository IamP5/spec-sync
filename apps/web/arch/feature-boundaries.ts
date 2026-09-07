import { posix } from 'node:path';

import ts from 'typescript';

import type { Dependency } from './utils';

const DOMAIN = /(?:^|\/)domains\/([^/]+)\//;
const FEATURE = /((?:^|.*\/)domains\/[^/]+\/feature-[^/]+)(?:\/|$)/;
const UI = /(?:^|\/)ui(?:-[^/]+)?\//;
const SMART = /-(page|search|edit|detail|overview)\.ts$/;
const STATE = /-(store|client|coordinator)\.ts$/;
const API = /\/api\/(contracts|features|preferences)\/index\.ts$/;

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
    if (
      /\/domains\/user\/state\//.test(target) &&
      !/\/domains\/user\/state\//.test(source) &&
      !(
        /\/domains\/user\/api\/preferences\/index\.ts$/.test(source) &&
        target.endsWith('/user-preferences-coordinator.ts')
      )
    ) {
      violations.push(`Private user state import: ${source} -> ${target}`);
    }
    const from = domain(source);
    const to = domain(target);
    if (from && to && from !== to && to !== 'shared') {
      const api = target.match(API)?.[1];
      const allowedConsumer =
        (from === 'chat' && (to === 'vehicles' || to === 'user')) ||
        (from === 'user' && to === 'auth' && api === 'features');
      const allowedLayer =
        api === 'contracts'
          ? /\/domains\/chat\/(data(?:-[^/]+)?|feature-[^/]+|ui(?:-[^/]+)?)\//.test(
              source,
            )
          : (api === 'features' ||
              (api === 'preferences' &&
                (SMART.test(source) || /-coordinator\.ts$/.test(source)))) &&
            !!feature(source) &&
            !isUi(source);
      if (!allowedConsumer || !allowedLayer)
        violations.push(`Domain boundary: ${source} -> ${target}`);
    }
    if (
      /\/api\/preferences\//.test(source) &&
      !target.endsWith('/domains/user/state/user-preferences-coordinator.ts')
    ) {
      violations.push(
        `Preference API must expose its coordinator: ${source} -> ${target}`,
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
