import type { Message } from '@ag-ui/client';

import { comparisonSchema } from '../../vehicles/api/contracts';
import { parseResult } from '../util/parse-result';

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
