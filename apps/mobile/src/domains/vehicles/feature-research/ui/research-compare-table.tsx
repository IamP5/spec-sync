import { ScrollView, View } from 'react-native';

import { Text } from '../../../../design-system/components/ui/text';
import type { ResearchSnapshot } from '../../data/research-contracts';
import type {
  ResearchComparisonRow,
  ResearchEvidenceFocus,
} from '../../data/research-presentation';
import { ResearchClaimValues } from './research-claim-values';

/**
 * Source data per version side by side, still subject to review. The table
 * scrolls sideways; the specification column stays readable at phone width.
 */
export function ResearchCompareTable({
  research,
  rows,
  onEvidence,
}: {
  research: ResearchSnapshot;
  rows: readonly ResearchComparisonRow[];
  onEvidence: (focus: ResearchEvidenceFocus) => void;
}) {
  return (
    <View
      className="border-border mt-4 border-y"
      accessibilityLabel="Version comparison"
    >
      <Text className="text-muted-foreground py-2 text-xs">
        Source data per version, still subject to review.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View className="flex-row">
            <View className="w-32 p-2">
              <Text className="text-xs font-medium">Specification</Text>
            </View>
            {research.configurations.map((configuration, index) => (
              <View key={configuration.name} className="w-44 p-2">
                <Text className="text-muted-foreground text-xs">
                  {index + 1} · {research.request.model}
                </Text>
                <Text className="mt-1 text-xs font-semibold">
                  {configuration.name}
                </Text>
              </View>
            ))}
          </View>
          {rows.map((row) => (
            <View key={row.code} className="border-border flex-row border-t">
              <View className="w-32 p-2">
                <Text className="text-muted-foreground text-xs">
                  {row.label}
                </Text>
              </View>
              {row.cells.map((cell, index) => (
                <View key={index} className="w-44 p-2">
                  <ResearchClaimValues
                    claims={cell}
                    onEvidence={(attribute) =>
                      onEvidence({
                        configuration:
                          research.configurations[index]?.name ?? '',
                        attribute,
                      })
                    }
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
