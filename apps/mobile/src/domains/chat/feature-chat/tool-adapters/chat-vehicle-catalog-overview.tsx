import { View } from 'react-native';

import { Text } from '../../../../design-system/components/ui/text';
import {
  catalogPageSchema,
  failureSchema,
  type VehicleConfiguration,
} from '../../../vehicles/api/contracts';
import { VehicleCatalogOverview } from '../../../vehicles/api/features';
import {
  catalogPageWithContinuation,
  catalogQueryLabel,
} from '../../data/catalog-tool-result';
import { parseResult } from '../../util/parse-result';
import type { ToolAdapterProps } from './chat-tool-registry';
import {
  vehicleComparisonPrompt,
  vehicleQuestionPrompt,
} from './vehicle-prompts';

/**
 * `searchVehicleConfigurations`: one catalog per tool result (ADR-0001).
 * Notices and the empty outcome are quiet lines; only a catalog with
 * vehicles takes the wider surface. A workspace passes a shared shortlist.
 */
export function ChatVehicleCatalogOverview({
  call,
  actions,
  shortlist,
  onShortlistChange,
}: ToolAdapterProps & {
  shortlist?: VehicleConfiguration[];
  onShortlistChange?: (vehicles: VehicleConfiguration[]) => void;
}) {
  const result = parseResult(call.result, catalogPageSchema);
  const notices = result?.notices ?? [];
  const empty = result?.items.length === 0 && !result.hasMore;
  return (
    <View className="gap-2">
      {notices.map((notice, index) => (
        <Text
          // Notices carry no id; their order is the result's order.
          key={index}
          accessibilityLiveRegion="polite"
          className="text-muted-foreground text-sm"
        >
          {notice}
        </Text>
      ))}
      {empty ? (
        notices.length ? null : (
          <Text
            accessibilityLiveRegion="polite"
            className="text-muted-foreground text-sm"
          >
            No configurations found for {catalogQueryLabel(call.args)}.
          </Text>
        )
      ) : (
        <VehicleCatalogOverview
          page={catalogPageWithContinuation(result, call.args)}
          failure={parseResult(call.result, failureSchema)?.message}
          complete={call.status === 'complete'}
          shortlist={shortlist}
          onShortlistChange={onShortlistChange}
          onQuestion={(question) =>
            actions.draft(vehicleQuestionPrompt(question))
          }
          onCompare={(vehicles) => {
            const prompt = vehicleComparisonPrompt(vehicles);
            // A tap is never lost: while the chat cannot send, the prompt
            // waits in the composer.
            if (actions.canSend) actions.send(prompt);
            else actions.draft(prompt);
          }}
        />
      )}
    </View>
  );
}
