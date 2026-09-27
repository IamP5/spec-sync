import { Pressable } from 'react-native';

import { Text } from '../../../design-system/components/ui/text';
import { cn } from '../../../design-system/lib/utils';

/** A text link to an external source; the host decides how to open it. */
export function LinkButton({
  label,
  accessibilityLabel,
  className,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  className?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      className="min-h-11 justify-center self-start"
      onPress={onPress}
    >
      <Text
        className={cn('text-info text-xs font-medium underline', className)}
      >
        {label}
      </Text>
    </Pressable>
  );
}
