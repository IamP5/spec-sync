import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '../../../../design-system/components/ui/text';

/** Icon and label of one appearance option. */
export function ThemeOptionPane({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-2">
      {children}
      <Text className="text-sm">{label}</Text>
    </View>
  );
}
