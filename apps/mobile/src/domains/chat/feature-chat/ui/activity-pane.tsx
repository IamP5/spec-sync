import { View } from 'react-native';

import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import type { ToolActivity } from '../../data/chat-message';
import { toolStatusLabel } from '../../util/tool-label';
import { DisclosurePane } from './disclosure-pane';

/**
 * Every tool call of a turn with its input and output (shown when "Show
 * thinking and tool activity" is on), separate from the result cards.
 */
export function ActivityPane({ activities }: { activities: ToolActivity[] }) {
  return (
    <View className="gap-2">
      {activities.map((activity) => (
        <DisclosurePane
          key={activity.id}
          title={activity.label}
          trailing={
            <Text
              className={cn(
                'text-xs',
                activity.status === 'failed'
                  ? 'text-destructive'
                  : 'text-muted-foreground',
              )}
            >
              {toolStatusLabel(activity.status)}
            </Text>
          }
        >
          <Text className="text-muted-foreground text-xs">{activity.name}</Text>
          <Text className="text-xs font-medium">Input</Text>
          <Text
            selectable
            className="bg-muted rounded-md p-2 font-mono text-xs"
          >
            {activity.input || '—'}
          </Text>
          <Text className="text-xs font-medium">Output</Text>
          <Text
            selectable
            numberOfLines={40}
            className="bg-muted rounded-md p-2 font-mono text-xs"
          >
            {activity.result || '—'}
          </Text>
        </DisclosurePane>
      ))}
    </View>
  );
}
