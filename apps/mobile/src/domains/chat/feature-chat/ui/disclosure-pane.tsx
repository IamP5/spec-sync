import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';

/** A collapsible section with a quiet header (the web `<details>` element). */
export function DisclosurePane({
  title,
  trailing,
  children,
  initiallyOpen = false,
}: {
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View className="border-border rounded-lg border">
      <Pressable
        role="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        className="min-h-11 flex-row items-center gap-2 px-3 py-2"
      >
        <Icon
          as={open ? ChevronDown : ChevronRight}
          className="text-muted-foreground size-4"
        />
        <Text className="text-muted-foreground flex-1 text-sm font-medium">
          {title}
        </Text>
        {trailing}
      </Pressable>
      {open ? <View className="gap-2 px-3 pb-3">{children}</View> : null}
    </View>
  );
}
