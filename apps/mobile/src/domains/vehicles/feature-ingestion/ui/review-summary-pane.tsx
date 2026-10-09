import { View } from 'react-native';

import { Badge } from '../../../../design-system/components/ui/badge';
import { Button } from '../../../../design-system/components/ui/button';
import { Text } from '../../../../design-system/components/ui/text';
import { plural } from '../../data/research-presentation';
import type { DecisionCounts } from '../review-decisions';

/**
 * The review's summary strip under the research journal: what is selected,
 * pending and published, and the way into the decisions.
 */
export function ReviewSummaryPane({
  totals,
  preApproved,
  reviewable,
  onOpen,
}: {
  totals: DecisionCounts;
  preApproved: number;
  reviewable: boolean;
  onOpen: () => void;
}) {
  return (
    <View
      className="border-border rounded-xl border p-4"
      accessibilityLabel="Review and publication"
    >
      <Text role="heading" className="text-base font-semibold">
        Review and publication
      </Text>
      <Text className="text-muted-foreground mt-1 text-sm">
        {totals.selected} selected · {totals.pending} pending ·{' '}
        {totals.published} published
      </Text>
      {preApproved ? (
        <Text className="text-muted-foreground mt-1 text-xs">
          {plural(
            preApproved,
            '1 attribute pre-approved',
            '{n} attributes pre-approved',
          )}
          : one evidenced candidate and no conflict. Only conflicts and
          unverified evidence wait for you.
        </Text>
      ) : null}
      {reviewable ? (
        <Button
          className="mt-3 min-h-11 self-start"
          accessibilityRole="button"
          accessibilityLabel={
            totals.pending
              ? `Review decisions, ${totals.pending} pending`
              : 'Review decisions'
          }
          onPress={onOpen}
        >
          <Text>Review decisions</Text>
          {totals.pending ? (
            <Badge variant="secondary">
              <Text>{totals.pending}</Text>
            </Badge>
          ) : null}
        </Button>
      ) : null}
    </View>
  );
}
