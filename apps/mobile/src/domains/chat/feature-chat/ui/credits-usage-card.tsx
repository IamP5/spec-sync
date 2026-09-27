import { View } from 'react-native';

import { Progress } from '../../../../design-system/components/ui/progress';
import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import {
  type CreditsWallet,
  formatCredits,
  usedShare,
} from '../../data/credits';

/** "AI Credits": balance, how much of the grant is used (web `CreditsUsageCard`). */
export function CreditsUsageCard({ wallet }: { wallet: CreditsWallet }) {
  return (
    <View className="gap-2">
      <Text className="text-muted-foreground text-xs font-medium uppercase">
        AI Credits
      </Text>
      <View className="flex-row items-baseline gap-2">
        <Text
          className={cn(
            'text-2xl font-semibold',
            wallet.exhausted && 'text-destructive',
          )}
        >
          {formatCredits(wallet.balance)}
        </Text>
        <Text className="text-muted-foreground text-sm">
          {wallet.exhausted
            ? 'Used up'
            : `of ${formatCredits(wallet.granted)} left`}
        </Text>
      </View>
      <Progress
        value={Math.round(usedShare(wallet) * 100)}
        accessibilityLabel={`Used ${formatCredits(wallet.spent)} of ${formatCredits(wallet.granted)}`}
      />
      <Text className="text-muted-foreground text-xs">
        {`Used ${formatCredits(wallet.spent)}`}
      </Text>
    </View>
  );
}
