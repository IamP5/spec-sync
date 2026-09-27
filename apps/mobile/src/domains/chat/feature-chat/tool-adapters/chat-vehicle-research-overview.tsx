import { View } from 'react-native';
import { z } from 'zod';

import { Text } from '../../../../design-system/components/ui/text';
import { VehicleResearchDetail } from '../../../vehicles/api/features';
import { parseResult } from '../../util/parse-result';
import type { ToolAdapterProps } from './chat-tool-registry';

/**
 * What the research tools return: only the private request id (and whether
 * its draft is ready for review). Everything else is read from the
 * authenticated snapshot endpoint, never from the tool output.
 */
export const researchReferenceSchema = z.object({
  id: z.string().uuid(),
  reviewReady: z.boolean().optional(),
});

/**
 * Renders `researchVehicleSpecifications`, `getVehicleResearch`,
 * `replayVehicleResearch` and `reviewVehicleResearch` (web
 * `ChatVehicleResearchDetail`): one research journal per tool result.
 */
export function ChatVehicleResearchOverview({ call }: ToolAdapterProps) {
  const reference = parseResult(call.result, researchReferenceSchema);
  if (!reference)
    return (
      <View className="border-border rounded-xl border p-4">
        <Text
          className="text-muted-foreground text-sm"
          accessibilityLiveRegion="polite"
        >
          {call.status === 'complete'
            ? 'Research could not be opened. Ask SpecSync to try again.'
            : 'Connecting to vehicle research…'}
        </Text>
      </View>
    );
  return (
    <View className="border-border w-full rounded-xl border p-4">
      <VehicleResearchDetail
        key={reference.id}
        requestId={reference.id}
        reviewInitiallyOpen={reference.reviewReady ?? false}
      />
    </View>
  );
}
