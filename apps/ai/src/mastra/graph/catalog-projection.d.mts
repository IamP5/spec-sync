export type Snapshot = Record<string, Record<string, unknown>[]>;
export type Statement = {
  statement: string;
  parameters?: Record<string, unknown>;
};
export function projectionStatements(
  snapshot: Snapshot,
  fingerprint: string,
): Statement[];
export const projectionConstraints: Statement[];
