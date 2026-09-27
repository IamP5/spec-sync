import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import {
  type CreditsWallet,
  formatCredits,
  usedShare,
} from '../../data/credits';
import { CreditsUsageCard } from './credits-usage-card';

/** The balance next to the composer; tapping it shows the details (web `CreditsPill`). */
export function CreditsPill({ wallet }: { wallet: CreditsWallet }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        role="button"
        accessibilityLabel={`AI credits: ${formatCredits(wallet.balance)}`}
        onPress={() => setOpen(true)}
        className="active:bg-accent min-h-11 flex-row items-center gap-1.5 rounded-full px-2.5"
      >
        <Text
          className={cn(
            'text-foreground/80 text-xs font-medium tabular-nums',
            wallet.exhausted && 'text-destructive',
          )}
        >
          {`${formatCredits(wallet.balance)} credits`}
        </Text>
        <View className="bg-foreground/10 h-1 w-8 overflow-hidden rounded-full">
          <View
            className={cn(
              'h-full rounded-full',
              wallet.exhausted ? 'bg-destructive' : 'bg-primary',
            )}
            style={{ width: `${Math.round(usedShare(wallet) * 100)}%` }}
          />
        </View>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setOpen(false)}
          role="button"
          accessibilityLabel="Close credits"
        >
          <Pressable
            className="bg-popover border-border gap-4 rounded-t-2xl border p-4 pb-8"
            onPress={() => undefined}
          >
            <CreditsUsageCard wallet={wallet} />
            {wallet.recentRuns.length > 0 ? (
              <View className="gap-1">
                <Text className="text-muted-foreground text-xs font-medium uppercase">
                  Recent replies
                </Text>
                {wallet.recentRuns.slice(0, 5).map((run) => (
                  <View key={run.runId} className="flex-row justify-between">
                    <Text
                      className="text-muted-foreground flex-1 text-sm"
                      numberOfLines={1}
                    >
                      {run.modelId}
                    </Text>
                    <Text className="text-sm">{formatCredits(run.charge)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
