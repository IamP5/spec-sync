import { Search, X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from '../../../design-system/components/ui/icon';
import { Input } from '../../../design-system/components/ui/input';
import { cn } from '../../../design-system/lib/utils';

/** A text filter with a search glyph and a clear button once it holds text. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  clearLabel = 'Clear search',
  className,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  clearLabel?: string;
  className?: string;
}) {
  return (
    <View className={cn('min-w-40 flex-1 justify-center', className)}>
      {/* An svg ignores absolute classes; its wrapper positions it. */}
      <View className="absolute left-3 z-10" pointerEvents="none">
        <Icon as={Search} className="text-muted-foreground size-4" />
      </View>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
        className="h-11 pr-11 pl-9 text-sm"
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearLabel}
          className="absolute right-0 z-10 size-11 items-center justify-center"
          onPress={() => onChangeText('')}
        >
          <Icon as={X} className="text-muted-foreground size-4" />
        </Pressable>
      ) : null}
    </View>
  );
}
