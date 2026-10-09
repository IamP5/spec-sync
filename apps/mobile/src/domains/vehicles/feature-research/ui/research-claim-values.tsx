import { Pressable, View } from 'react-native';

import { Text } from '../../../../design-system/components/ui/text';
import {
  availabilityLabel,
  DISPLAY_LOCALE,
  formatQualifiers,
} from '../../data/claim-presentation';
import type { IngestionClaim } from '../../data/ingestion-contracts';
import { researchClaimValue } from '../../data/research-presentation';

/**
 * The claims of one attribute in one version: each value opens its source
 * evidence; conditions, availability and open points stay beside it.
 */
export function ResearchClaimValues({
  claims,
  onEvidence,
}: {
  claims: readonly IngestionClaim[];
  onEvidence: (attributeCode: string) => void;
}) {
  if (!claims.length)
    return <Text className="text-muted-foreground text-xs">Not reported</Text>;
  return (
    <View className="gap-2">
      {claims.map((claim, index) => {
        const value = researchClaimValue(claim, DISPLAY_LOCALE);
        const conditions = formatQualifiers(claim.qualifiers);
        return (
          <View key={index}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${value}, open the source evidence`}
              accessibilityHint="Opens the research evidence"
              className="min-h-11 justify-center"
              onPress={() => onEvidence(claim.attributeCode)}
            >
              <Text className="text-sm font-medium">
                {value}{' '}
                <Text className="text-muted-foreground text-xs font-normal">
                  ↗ source
                </Text>
              </Text>
            </Pressable>
            {claim.availability ? (
              <Text className="text-muted-foreground text-xs">
                {availabilityLabel(claim.availability)}
              </Text>
            ) : null}
            {conditions ? (
              <Text className="text-muted-foreground mt-0.5 text-xs">
                {conditions}
              </Text>
            ) : null}
            {claim.issues.length ? (
              <Text className="text-warning mt-0.5 text-xs">
                {claim.issues.length === 1
                  ? 'one point to review'
                  : `${claim.issues.length} points to review`}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
