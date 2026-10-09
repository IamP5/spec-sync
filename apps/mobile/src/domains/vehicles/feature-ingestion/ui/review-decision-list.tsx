import { Check, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import { decisionStatusLabel } from '../ingestion-presentation';
import type { DecisionStatus, ReviewDecision } from '../review-decisions';

/**
 * The decision queue of one configuration: each row opens the decision.
 * A configuration holds at most a few dozen attributes, so the rows are
 * mapped inside the review's scroll view.
 */
export function ReviewDecisionList({
  decisions,
  statusOf,
  onOpen,
}: {
  decisions: readonly ReviewDecision[];
  statusOf: (decision: ReviewDecision) => DecisionStatus;
  onOpen: (attributeCode: string) => void;
}) {
  if (!decisions.length)
    return (
      <Text className="text-muted-foreground py-3 text-sm">
        No decision matches this filter.
      </Text>
    );
  return (
    <View accessibilityLabel="Decision queue">
      {decisions.map((decision, index) => {
        const status = statusOf(decision);
        const label = decisionStatusLabel(decision.kind, status);
        const done = status === 'selected' || status === 'published';
        return (
          <Pressable
            key={decision.attributeCode}
            accessibilityRole="button"
            accessibilityLabel={`${decision.label}, ${label}`}
            accessibilityHint="Opens the decision"
            className="border-border active:bg-accent min-h-14 flex-row items-center gap-3 border-b py-2"
            onPress={() => onOpen(decision.attributeCode)}
          >
            <View
              className="border-border size-6 items-center justify-center rounded-full border"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {done ? (
                <Icon as={Check} className="size-3.5" />
              ) : (
                <Text className="text-xs">{index + 1}</Text>
              )}
            </View>
            <View className="flex-1">
              <Text numberOfLines={1} className="text-sm font-medium">
                {decision.label}
              </Text>
              <Text className="text-muted-foreground text-xs">{label}</Text>
            </View>
            <Icon as={ChevronRight} className="text-muted-foreground size-4" />
          </Pressable>
        );
      })}
    </View>
  );
}
