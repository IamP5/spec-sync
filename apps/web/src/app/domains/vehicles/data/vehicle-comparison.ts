import type { z } from 'zod';

import { cellSchema, type Comparison } from './vehicle-contracts';

export function comparisonRows(
  comparison: Comparison | undefined,
  differencesOnly: boolean,
) {
  return (
    comparison?.rows.filter(
      (row) =>
        !differencesOnly ||
        row.cells.some((c) => c.knowledgeStatus !== 'KNOWN') ||
        new Set(row.cells.map(cellSignature)).size > 1,
    ) ?? []
  );
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
