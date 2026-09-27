import { Pressable, View } from 'react-native';

import { Text } from '../../../design-system/components/ui/text';
import { cn } from '../../../design-system/lib/utils';

/**
 * A pill that toggles one filter (model family, "Differences only", a review
 * format). The pill stays compact while the touch target keeps 44pt.
 */
export function FilterChip({
  label,
  count,
  selected,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  count?: number;
  selected: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      className="min-h-11 justify-center"
      onPress={onPress}
    >
      <View
        className={cn(
          'h-8 flex-row items-center gap-1 rounded-full border px-3',
          selected
            ? 'border-foreground bg-foreground'
            : 'border-border bg-background',
        )}
      >
        <Text
          numberOfLines={1}
          className={cn(
            'text-xs font-medium',
            selected ? 'text-background' : 'text-foreground',
          )}
        >
          {label}
        </Text>
        {count === undefined ? null : (
          <Text
            className={cn(
              'text-xs',
              selected ? 'text-background/70' : 'text-muted-foreground',
            )}
          >
            {count}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
