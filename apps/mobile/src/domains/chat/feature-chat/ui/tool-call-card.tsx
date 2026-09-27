import { Check, CircleAlert, Wrench } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';

/**
 * The generic card for a tool without a registered component (web
 * `ToolCallCard`): a spinner while it runs, a check once done, and its name.
 */
export function ToolCallCard({
  name,
  running,
  failed,
}: {
  name: string;
  running: boolean;
  failed: boolean;
}) {
  const label = name === 'skill' ? 'Reading the ingestion procedure' : name;
  return (
    <View
      className="border-border bg-muted/40 flex-row items-center gap-2 self-start rounded-lg border px-3 py-2"
      accessibilityLabel={`${label}: ${running ? 'running' : failed ? 'failed' : 'done'}`}
    >
      {running ? (
        <ActivityIndicator size="small" />
      ) : failed ? (
        <Icon as={CircleAlert} className="text-destructive size-4" />
      ) : (
        <Icon as={Check} className="text-success size-4" />
      )}
      <Icon as={Wrench} className="text-muted-foreground size-4" />
      <Text className="text-muted-foreground font-mono text-xs">{label}</Text>
    </View>
  );
}
