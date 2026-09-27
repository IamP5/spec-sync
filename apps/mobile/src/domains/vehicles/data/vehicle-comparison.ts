import type { z } from 'zod';

import { cellSchema, type Comparison } from './vehicle-contracts';

/**
 * Rows worth showing: an attribute no compared vehicle reports carries no
 * comparison, so it is left out (see `hiddenComparisonRowCount`).
 */
export function comparisonRows(
  comparison: Comparison | undefined,
  differencesOnly: boolean,
) {
  return (
    comparison?.rows.filter(
      (row) =>
        hasReportedValue(row) &&
        (!differencesOnly ||
          row.cells.some((c) => c.knowledgeStatus !== 'KNOWN') ||
          new Set(row.cells.map(cellSignature)).size > 1),
    ) ?? []
  );
}
/** Attributes left out because no compared vehicle reports them. */
export function hiddenComparisonRowCount(comparison: Comparison | undefined) {
  return comparison?.rows.filter((row) => !hasReportedValue(row)).length ?? 0;
}
function hasReportedValue(row: Comparison['rows'][number]): boolean {
  return row.cells.some((cell) => cell.knowledgeStatus !== 'NOT_REPORTED');
}
function cellSignature(cell: z.infer<typeof cellSchema>): string {
  const o = cell.observations.find((o) => o.id === cell.selectedObservationId);
  return JSON.stringify(
    o ? [o.value, o.availability, stable(o.qualifiers)] : null,
  );
}
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, stable(v)]),
    );
  return value;
}
export function cellObservations(cell: z.infer<typeof cellSchema>) {
  if (cell.knowledgeStatus === 'NOT_REPORTED') return [];
  return cell.knowledgeStatus === 'KNOWN'
    ? cell.observations.filter((o) => o.id === cell.selectedObservationId)
    : cell.observations;
}
