import {
  ChevronRight,
  GitCompareArrows,
  LayoutGrid,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';

/**
 * The home state of a new chat (web chat page empty state): the wordmark,
 * the tagline and two suggested prompts.
 */
export function ChatEmptyState({
  greeting,
  onCatalog,
  onComparison,
  disabled,
}: {
  greeting: string;
  onCatalog: () => void;
  onComparison: () => void;
  disabled: boolean;
}) {
  return (
    <View className="flex-1 justify-center gap-8 px-2 py-10">
      <View className="items-center gap-2">
        <Text className="text-primary text-4xl font-bold tracking-tight">
          SpecSync
        </Text>
        <Text className="text-muted-foreground text-center">
          {greeting || 'Every specification. A clearer decision.'}
        </Text>
      </View>
      <View className="bg-card border-border gap-1 rounded-xl border p-2">
        <Text className="text-muted-foreground px-2 pb-1 pt-1 text-xs font-medium uppercase">
          Suggested
        </Text>
        <Suggestion
          icon={LayoutGrid}
          title="Explore catalog"
          subtitle="Search, filters, details and a comparison shortlist."
          onPress={onCatalog}
          disabled={disabled}
        />
        <Suggestion
          icon={GitCompareArrows}
          title="Compare F-150 and RAM 2500"
          subtitle="Power, transmission and drivetrain, model year 2026."
          onPress={onComparison}
          disabled={disabled}
        />
      </View>
    </View>
  );
}

function Suggestion({
  icon,
  title,
  subtitle,
  onPress,
  disabled,
}: {
  icon: typeof LayoutGrid;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled}
      className="active:bg-accent min-h-14 flex-row items-center gap-3 rounded-lg px-2 py-2.5"
    >
      <View className="bg-muted size-10 items-center justify-center rounded-lg">
        <Icon as={icon} className="text-foreground size-5" />
      </View>
      <View className="flex-1">
        <Text className="font-medium">{title}</Text>
        <Text className="text-muted-foreground text-sm" numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Icon as={ChevronRight} className="text-muted-foreground size-4" />
    </Pressable>
  );
}
