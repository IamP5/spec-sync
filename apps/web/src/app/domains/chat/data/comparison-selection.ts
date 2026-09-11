import type { Message } from '@ag-ui/client';

import { comparisonSchema } from '../../vehicles/api/contracts';
import { parseResult } from '../util/parse-result';
import {
  vehicleWorkspaceSchema,
  vehicleWorkspaceTiles,
} from './vehicle-workspace-contracts';

export interface ComparisonSelectionState {
  version: 1;
  configurationIds: string[];
  attributeCodes: string[];
  lastComparisonToolCallId: string;
}
/** Derive selection from successful structured tool results, not assistant prose. */
export function comparisonSelection(
  messages: Message[],
): ComparisonSelectionState | undefined {
  const calls = new Map<string, string>();
  let selection: ComparisonSelectionState | undefined;
  for (const message of messages) {
    if (message.role === 'assistant')
      for (const call of message.toolCalls ?? [])
        if (
          call.function.name === 'compareVehicleConfigurations' ||
          call.function.name === 'renderVehicleWorkspace'
        )
          calls.set(call.id, call.function.name);
    if (
      message.role === 'tool' &&
      !message.error &&
      calls.has(message.toolCallId)
    ) {
      const workspace =
        calls.get(message.toolCallId) === 'renderVehicleWorkspace'
          ? parseResult(message.content, vehicleWorkspaceSchema)
          : undefined;
      const comparisons = workspace
        ? vehicleWorkspaceTiles(workspace).flatMap((tile) =>
            tile.type === 'comparison' && 'configurations' in tile.result
              ? [tile.result]
              : [],
          )
        : [];
      // Several comparison panels are ambiguous; a follow-up must identify one.
      if (comparisons.length > 1) {
        selection = undefined;
        continue;
      }
      const comparison =
        calls.get(message.toolCallId) === 'renderVehicleWorkspace'
          ? comparisons[0]
          : parseResult(message.content, comparisonSchema);
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
