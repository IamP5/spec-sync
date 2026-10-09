import { View } from 'react-native';

import { Badge } from '../../../../design-system/components/ui/badge';
import { Text } from '../../../../design-system/components/ui/text';
import { Textarea } from '../../../../design-system/components/ui/textarea';
import { CheckRow } from '../../ui/check-row';
import type { PublicationBatch } from '../review-model';

/**
 * The publication summary (web "Publication summary"): what each
 * participating configuration would publish, its identity confirmation and
 * optional reason, and the review reason. The owner holds every value.
 */
export function ReviewPublicationPane({
  batches,
  reason,
  onReasonChange,
  onIdentityChange,
  onConfigurationReasonChange,
}: {
  batches: readonly PublicationBatch[];
  reason: string;
  onReasonChange: (reason: string) => void;
  onIdentityChange: (index: number, confirmed: boolean) => void;
  onConfigurationReasonChange: (index: number, reason: string) => void;
}) {
  const unconfirmed = batches
    .filter((batch) => !batch.state.identityConfirmed)
    .map((batch) => batch.name);
  return (
    <View accessibilityLabel="Publication summary">
      <Text role="heading" className="text-base font-semibold">
        Publication summary
      </Text>
      <Text className="text-muted-foreground mt-1 text-sm">
        Only the selected specifications are published. Open conflicts,
        unverified evidence and decisions set aside stay pending for a later
        review of this same research.
      </Text>
      <View className="mt-3 gap-3">
        {batches.length ? (
          batches.map((batch) => (
            <View
              key={batch.name}
              className="border-border gap-3 rounded-lg border p-3"
            >
              <View className="flex-row flex-wrap items-center justify-between gap-2">
                <Text className="text-sm font-semibold">{batch.name}</Text>
                <View className="flex-row flex-wrap gap-1">
                  <Badge variant="secondary">
                    <Text>{batch.items.length} selected</Text>
                  </Badge>
                  <Badge
                    variant={
                      batch.state.identityConfirmed ? 'default' : 'destructive'
                    }
                  >
                    <Text>
                      {batch.state.identityConfirmed
                        ? 'Ready to publish'
                        : 'Confirm the identity'}
                    </Text>
                  </Badge>
                </View>
              </View>
              <View>
                {batch.items.map((item) => (
                  <View
                    key={item.label}
                    className="border-border flex-row justify-between gap-3 border-b py-1"
                  >
                    <Text className="flex-1 text-sm">{item.label}</Text>
                    <Text className="text-right text-sm font-semibold">
                      {item.proposed}
                    </Text>
                  </View>
                ))}
              </View>
              <CheckRow
                checked={batch.state.identityConfirmed}
                accessibilityLabel={`This source applies to ${batch.name}, exactly this model year`}
                onChange={(checked) => onIdentityChange(batch.index, checked)}
              >
                <Text className="text-sm">
                  This source applies to{' '}
                  <Text className="text-sm font-semibold">{batch.name}</Text>,
                  exactly this model year
                </Text>
              </CheckRow>
              <View>
                <Text className="mb-1 text-sm font-medium">
                  Reason for this configuration (optional)
                </Text>
                <Textarea
                  accessibilityLabel={`Reason for ${batch.name} (optional)`}
                  numberOfLines={3}
                  placeholder="Only when this configuration needs its own justification."
                  value={batch.state.reason}
                  onChangeText={(text) =>
                    onConfigurationReasonChange(batch.index, text)
                  }
                />
              </View>
            </View>
          ))
        ) : (
          <Text className="text-muted-foreground text-sm">
            Select at least one specification to publish.
          </Text>
        )}
      </View>
      <Text className="mb-1 mt-4 text-sm font-medium">Review reason</Text>
      <Textarea
        accessibilityLabel="Review reason"
        numberOfLines={4}
        placeholder="Explain applicability and why these specifications should enter the catalog."
        value={reason}
        onChangeText={onReasonChange}
      />
      {unconfirmed.length ? (
        <Text
          className="text-destructive mt-3 text-sm"
          accessibilityLiveRegion="polite"
        >
          Confirm the identity of {unconfirmed.join(', ')} before publishing its
          specifications.
        </Text>
      ) : null}
    </View>
  );
}
