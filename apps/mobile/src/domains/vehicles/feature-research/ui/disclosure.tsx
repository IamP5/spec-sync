import { ChevronDown } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';

/** A summary line that shows or hides its details (the web `<details>`). */
export function Disclosure({
  summary,
  initiallyOpen = false,
  summaryClassName,
  children,
}: {
  summary: string;
  initiallyOpen?: boolean;
  summaryClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary}
        accessibilityState={{ expanded: open }}
        className="min-h-11 flex-row items-center gap-1"
        onPress={() => setOpen(!open)}
      >
        <Icon
          as={ChevronDown}
          className={cn(
            'text-muted-foreground size-4',
            open ? 'rotate-180' : '',
          )}
        />
        <Text className={cn('flex-1 text-xs', summaryClassName)}>
          {summary}
        </Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}
