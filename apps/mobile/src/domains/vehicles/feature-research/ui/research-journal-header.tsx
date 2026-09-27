import { View } from 'react-native';

import { Text } from '../../../../design-system/components/ui/text';
import type { ResearchSnapshot } from '../../data/research-contracts';
import {
  researchDispositionLabel,
  researchStage,
} from '../../data/research-presentation';

/** The journal's title, the requested scope and the current step. */
export function ResearchJournalHeader({
  research,
  error,
}: {
  research: ResearchSnapshot;
  /** A refresh failure; the last snapshot stays on screen. */
  error: string;
}) {
  const stage = researchStage(research);
  const terminalError =
    research.status === 'FAILED' || research.status === 'REJECTED'
      ? research.error
      : null;
  return (
    <View className="border-border border-b pb-5">
      <Text className="text-muted-foreground text-xs">
        Vehicle research · {researchDispositionLabel(research.disposition)}
      </Text>
      <Text
        role="heading"
        className="mt-2 text-2xl font-semibold tracking-tight"
      >
        Getting to know {research.request.brand} {research.request.model}.
      </Text>
      <Text className="text-muted-foreground mt-2 text-xs">
        {research.request.market} · {research.request.modelYear} requested ·
        confirm the model year in the evidence
      </Text>
      <View
        className="mt-4 flex-row items-start gap-3"
        accessibilityRole="summary"
        accessibilityLiveRegion="polite"
      >
        <View
          className="bg-foreground size-10 items-center justify-center rounded-full"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text className="text-background text-lg font-semibold">
            {stage.index + 1}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-muted-foreground text-xs uppercase tracking-widest">
            Step {stage.index + 1} of 4
          </Text>
          <Text className="mt-1 text-base font-semibold">{stage.label}</Text>
          <Text className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {stage.note}
          </Text>
        </View>
      </View>
      {research.replayedFromWorkId ? (
        <Text className="text-muted-foreground mt-3 text-xs">
          A new interpretation of the source has been saved. The original
          research stays in the history.
        </Text>
      ) : null}
      {terminalError ? (
        <Text role="alert" className="text-destructive mt-3 text-sm">
          {terminalError}
        </Text>
      ) : null}
      {error ? (
        <Text role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
