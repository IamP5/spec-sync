import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Checkbox } from '../../../design-system/components/ui/checkbox';
import { cn } from '../../../design-system/lib/utils';

/**
 * A whole row that toggles one checkbox (an identity confirmation, a consent):
 * the row is the 44pt target and the accessible checkbox; the box is visual.
 */
export function CheckRow({
  checked,
  onChange,
  accessibilityLabel,
  disabled = false,
  bordered = true,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  bordered?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      className={cn(
        'min-h-11 flex-row items-start gap-3 py-2',
        bordered && 'rounded-lg border px-3',
        bordered && (checked ? 'border-primary' : 'border-border'),
        disabled && 'opacity-50',
      )}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="pt-0.5"
      >
        <Checkbox checked={checked} onCheckedChange={onChange} />
      </View>
      <View className="flex-1">{children}</View>
    </Pressable>
  );
}
