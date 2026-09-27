import { Pressable, View } from 'react-native';

import { Text } from '../../../../design-system/components/ui/text';
import { cellObservations } from '../../data/vehicle-comparison';
import type { VehicleConfiguration } from '../../data/vehicle-contracts';
import { LinkButton } from '../../ui/link-button';
import { safeSourceUrl } from '../../util/vehicle-display';
import {
  cellOf,
  type ComparisonRow,
  evidenceProvenance,
  observationValue,
  qualifierLabels,
} from '../comparison-presentation';

/**
 * The sources behind one attribute, per vehicle: unknowns and conflicts in
 * words, qualifiers, and every evidence excerpt with its original reference.
 */
export function VehicleComparisonSources({
  row,
  configurations,
  numbered,
  questionsEnabled,
  onReviews,
  onOpenLink,
}: {
  row: ComparisonRow;
  configurations: VehicleConfiguration[];
  numbered: boolean;
  questionsEnabled: boolean;
  onReviews: (row: ComparisonRow, configurationId?: string) => void;
  onOpenLink: (url: string) => void;
}) {
  return (
    <View className="gap-3 pb-1">
      {configurations.map((configuration, index) => {
        const cell = cellOf(row, configuration.id);
        return (
          <View key={configuration.id} className="min-w-0">
            <Text className="text-xs font-medium">
              {numbered ? `${index + 1} · ` : ''}
              {configuration.model} {configuration.name}
            </Text>
            {cell ? (
              <>
                {cell.knowledgeStatus === 'NOT_REPORTED' ? (
                  <Text className="text-muted-foreground text-xs leading-5">
                    Not reported. Missing information does not mean the
                    equipment is absent.
                  </Text>
                ) : null}
                {cell.knowledgeStatus === 'CONFLICTING' ? (
                  <Text className="text-warning text-xs leading-5">
                    Conflicting data. The sources disagree; check the records
                    below.
                  </Text>
                ) : null}
                {cellObservations(cell).map((observation) => (
                  <View key={observation.id} className="mt-1">
                    {cell.knowledgeStatus === 'CONFLICTING' ? (
                      <Text className="text-xs font-medium tabular-nums">
                        {observationValue(observation, row)}
                      </Text>
                    ) : null}
                    {qualifierLabels(observation.qualifiers).map(
                      (qualifier) => (
                        <Text
                          key={qualifier}
                          className="text-muted-foreground text-xs leading-5"
                        >
                          {qualifier}
                        </Text>
                      ),
                    )}
                    {observation.evidence.length ? (
                      observation.evidence.map((evidence) => (
                        <View
                          key={evidence.id}
                          className="border-border mt-1 border-l-2 pl-2"
                        >
                          <Text className="text-xs font-medium">
                            {evidence.title}
                          </Text>
                          <Text className="text-muted-foreground text-xs">
                            {evidence.locator} · captured on{' '}
                            {evidence.capturedOn}
                          </Text>
                          <Text
                            numberOfLines={4}
                            className="text-muted-foreground mt-1 text-xs leading-5"
                          >
                            {evidence.excerpt}
                          </Text>
                          <Text className="text-muted-foreground mt-1 text-xs leading-5">
                            {evidenceProvenance(evidence.provenance)} · the
                            original reference does not represent independent
                            verification.
                          </Text>
                          {evidence.upstreamUrls.map((url) => {
                            const href = safeSourceUrl(url);
                            return href ? (
                              <LinkButton
                                key={url}
                                label="Original reference ↗"
                                accessibilityLabel="Original reference (opens the browser)"
                                className="text-foreground"
                                onPress={() => onOpenLink(href)}
                              />
                            ) : null;
                          })}
                        </View>
                      ))
                    ) : (
                      <Text className="text-muted-foreground text-xs">
                        No evidence attached to this record.
                      </Text>
                    )}
                  </View>
                ))}
                {questionsEnabled ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Reports for this version: ${configuration.name} about ${row.attribute.label}`}
                    className="min-h-11 justify-center self-start"
                    onPress={() => onReviews(row, configuration.id)}
                  >
                    <Text className="text-muted-foreground text-xs underline">
                      Reports for this version ↗
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
