import type { Message } from '@ag-ui/client';
import { z } from 'zod';

import {
  cellSchema,
  type Comparison,
  comparisonSchema,
} from './vehicle-contracts';

export interface ComparisonSelectionState {
  version: 1;
  configurationIds: string[];
  attributeCodes: string[];
  lastComparisonToolCallId: string;
}
export function parseResult<T>(
  value: unknown,
  schema: z.ZodType<T>,
): T | undefined {
  try {
    const parsed = schema.safeParse(
      typeof value === 'string' ? JSON.parse(value) : value,
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
/** Derive selection from successful structured tool results, not assistant prose. */
export function comparisonSelection(
  messages: Message[],
): ComparisonSelectionState | undefined {
  const calls = new Set<string>();
  let selection: ComparisonSelectionState | undefined;
  for (const message of messages) {
    if (message.role === 'assistant')
      for (const call of message.toolCalls ?? [])
        if (call.function.name === 'compareVehicleConfigurations')
          calls.add(call.id);
    if (message.role === 'tool' && calls.has(message.toolCallId)) {
      const comparison = parseResult(message.content, comparisonSchema);
      if (comparison)
        selection = {
          version: 1,
          configurationIds: comparison.configurations.map((c) => c.id),
          attributeCodes: comparison.rows.map((r) => r.attribute.code),
          lastComparisonToolCallId: message.toolCallId,
        };
    }
  }
  return selection;
}
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
export function displayValue(value: unknown): string {
  return typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? value.map(displayValue).join(', ')
      : value == null
        ? ''
        : JSON.stringify(value);
}
export function safeSourceUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
