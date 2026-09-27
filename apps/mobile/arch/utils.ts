export interface Dependency {
  source: string;
  target: string;
}

// Selects every `.ts`/`.tsx` file that is none of the given kinds.
//
// Example: anyFileExcept(STORE, COORDINATOR) selects all files that are
// neither a store nor a coordinator.
//
// Technically, each kind becomes a negative lookahead (`(?!...)`, i.e. "must
// not be present"). anyFileExcept('-a.ts', '-b.ts') produces the pattern:
//   ^(?!.*-a.ts)(?!.*-b.ts).*\.tsx?$
export function anyFileExcept(...kinds: string[]): string {
  return String.raw`^${kinds.map((kind) => `(?!.*${kind})`).join('')}.*\.tsx?$`;
}

export function toDependency(violation: unknown): Dependency {
  const { dependency } = violation as {
    dependency: { sourceLabel: string; targetLabel: string };
  };
  return { source: dependency.sourceLabel, target: dependency.targetLabel };
}

export function formatDependency(dependency: Dependency): string {
  return `${dependency.source} -> ${dependency.target}`;
}
