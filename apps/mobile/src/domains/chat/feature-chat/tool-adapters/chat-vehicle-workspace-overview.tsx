import { useState } from 'react';
import { View } from 'react-native';

import { Skeleton } from '../../../../design-system/components/ui/skeleton';
import { Text } from '../../../../design-system/components/ui/text';
import type { VehicleConfiguration } from '../../../vehicles/api/contracts';
import type { ToolCallView } from '../../data/tool-call';
import {
  vehicleWorkspaceSchema,
  workspaceCatalogConfigurations,
  workspaceTileCalls,
} from '../../data/vehicle-workspace-contracts';
import { parseResult } from '../../util/parse-result';
import { ChatKnowledgeResultOverview } from './chat-knowledge-result-overview';
import type { ToolAdapterProps } from './chat-tool-registry';
import { ChatVehicleCatalogOverview } from './chat-vehicle-catalog-overview';
import { ChatVehicleComparisonOverview } from './chat-vehicle-comparison-overview';

const MAX_SHORTLIST = 5;

/**
 * `renderVehicleWorkspace`: a bounded A2UI surface whose tiles are real
 * domain results (catalog, comparison, specifications, review evidence).
 * Each tile renders through the adapter of the tool that owns its result
 * type; the catalogs share one comparison shortlist.
 */
export function ChatVehicleWorkspaceOverview({
  call,
  actions,
}: ToolAdapterProps) {
  const workspace = parseResult(call.result, vehicleWorkspaceSchema);
  const surfaceId = workspace?.operations[0].createSurface.surfaceId;
  const available = workspaceCatalogConfigurations(workspace);
  // The shortlist belongs to one surface; revised data drops vehicles it no
  // longer contains.
  const [selection, setSelection] = useState<{
    surfaceId?: string;
    ids: string[];
  }>({ ids: [] });
  const shortlist = (
    selection.surfaceId === surfaceId ? selection.ids : []
  ).flatMap((id) => available.get(id) ?? []);
  const updateShortlist = (vehicles: VehicleConfiguration[]) =>
    setSelection({
      surfaceId,
      ids: [...new Set(vehicles.map(({ id }) => id))].slice(0, MAX_SHORTLIST),
    });

  if (!workspace)
    return call.status !== 'complete' ? (
      <View
        className="border-border bg-card gap-3 rounded-xl border p-4"
        accessibilityLabel="Building vehicle workspace"
        accessibilityState={{ busy: true }}
      >
        <Text className="text-sm font-medium" accessibilityLiveRegion="polite">
          Building your vehicle workspace…
        </Text>
        <Text className="text-muted-foreground text-sm">
          Gathering catalog data, specifications, and evidence for your request.
        </Text>
        <Skeleton className="h-24 rounded-lg" />
      </View>
    ) : (
      <View
        className="border-border bg-card gap-2 rounded-xl border p-4"
        accessibilityLabel="Vehicle workspace unavailable"
      >
        <Text className="text-sm font-medium">
          This workspace could not be displayed.
        </Text>
        <Text className="text-muted-foreground text-sm">
          Ask again with the vehicles or specifications you want to explore.
        </Text>
      </View>
    );

  return (
    <View
      className="border-border bg-card gap-4 rounded-xl border p-4"
      accessibilityLabel={workspace.title}
    >
      <View className="gap-1">
        <Text className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Vehicle workspace
        </Text>
        <Text role="heading" className="text-lg font-semibold tracking-tight">
          {workspace.title}
        </Text>
        <Text className="text-muted-foreground text-sm">
          Explore the catalog, inspect sources, and carry your selections into
          the conversation.
        </Text>
      </View>
      {workspace.status !== 'OK' ? (
        <View className="bg-muted rounded-lg p-3">
          <Text className="text-sm" accessibilityLiveRegion="polite">
            {workspace.status === 'PARTIAL'
              ? 'Some sections could not be loaded. The available results are ready to explore.'
              : 'This workspace could not retrieve its data. Try a narrower search or ask again.'}
          </Text>
        </View>
      ) : null}
      {actions.canSend ? null : (
        <Text className="text-muted-foreground text-sm">
          You can explore these results now. Sending a follow-up will be
          available when the conversation is ready.
        </Text>
      )}
      {workspaceTileCalls(workspace, call.id).map((tile) => (
        <View
          key={tile.call.id}
          className="min-w-0 gap-2"
          accessibilityLabel={tile.title}
        >
          <Text className="text-sm font-semibold">{tile.title}</Text>
          <WorkspaceTile
            type={tile.type}
            call={tile.call}
            actions={actions}
            shortlist={shortlist}
            onShortlistChange={updateShortlist}
          />
        </View>
      ))}
    </View>
  );
}

function WorkspaceTile({
  type,
  call,
  actions,
  shortlist,
  onShortlistChange,
}: ToolAdapterProps & {
  type: 'catalog' | 'comparison' | 'specifications' | 'reviews';
  call: ToolCallView;
  shortlist: VehicleConfiguration[];
  onShortlistChange: (vehicles: VehicleConfiguration[]) => void;
}) {
  switch (type) {
    case 'catalog':
      return (
        <ChatVehicleCatalogOverview
          call={call}
          actions={actions}
          shortlist={shortlist}
          onShortlistChange={onShortlistChange}
        />
      );
    case 'comparison':
    case 'specifications':
      return <ChatVehicleComparisonOverview call={call} actions={actions} />;
    case 'reviews':
      return <ChatKnowledgeResultOverview call={call} actions={actions} />;
  }
}
