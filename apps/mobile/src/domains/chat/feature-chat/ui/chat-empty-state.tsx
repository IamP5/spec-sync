import { ArrowLeftRight, ArrowUpRight, CarFront } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { FordScript } from '../../../../design-system/components/brand/ford-script';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';

/**
 * The home state of a new chat (web chat page home on a phone): the Ford /
 * SpecSync lockup and the tagline centred in the free space, and two quiet
 * suggestions just above the composer.
 */
export function ChatEmptyState({
  onCatalog,
  onComparison,
  disabled,
}: {
  onCatalog: () => void;
  onComparison: () => void;
  disabled: boolean;
}) {
  return (
    <View className="flex-1">
      <View className="flex-1 items-center justify-center gap-4 px-4 py-8">
        <View
          role="heading"
          accessibilityLabel="Ford SpecSync"
          className="flex-row items-center gap-4"
        >
          <FordScript width={72} height={30} />
          <View className="bg-border h-8 w-px rotate-[18deg]" />
          <Text className="text-[31px] font-semibold leading-[34px] tracking-[-2px]">
            SpecSync
          </Text>
        </View>
        <Text className="text-muted-foreground max-w-sm text-center text-sm leading-relaxed">
          Every specification. A clearer decision.
        </Text>
      </View>
      <View className="mx-1 mb-1">
        <Suggestion
          icon={CarFront}
          title="Explore catalog"
          hint="Search, filters, details and a comparison shortlist."
          onPress={onCatalog}
          disabled={disabled}
        />
        <Suggestion
          icon={ArrowLeftRight}
          title="Compare F-150 and RAM 2500"
          hint="Power, transmission and drivetrain, model year 2026."
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
  hint,
  onPress,
  disabled,
}: {
  icon: typeof CarFront;
  title: string;
  hint: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      role="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      onPress={onPress}
      disabled={disabled}
      className="active:bg-accent min-h-11 flex-row items-center gap-3 rounded-lg px-2 py-2.5 disabled:opacity-50"
    >
      <Icon as={icon} className="text-muted-foreground size-5" />
      <Text className="flex-1 text-sm" numberOfLines={1}>
        {title}
      </Text>
      <Icon
        as={ArrowUpRight}
        className="text-muted-foreground size-3.5 opacity-70"
      />
    </Pressable>
  );
}
