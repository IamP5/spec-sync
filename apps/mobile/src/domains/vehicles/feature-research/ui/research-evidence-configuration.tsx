import { View } from 'react-native';

import { Badge } from '../../../../design-system/components/ui/badge';
import { Text } from '../../../../design-system/components/ui/text';
import {
  availabilityLabel,
  claimLocator,
  formatQualifiers,
} from '../../data/claim-presentation';
import type {
  IngestionConfigurationDraft,
  IngestionUnmappedObservation,
} from '../../data/ingestion-contracts';
import {
  plural,
  proposalKindLabel,
  researchEvidenceValue,
} from '../../data/research-presentation';
import { Disclosure } from './disclosure';

function Excerpt({ text }: { text: string }) {
  return (
    <Text className="border-border mt-1 border-l-2 pl-3 text-xs">{text}</Text>
  );
}

function evidenceSummary(item: {
  lineStart: number;
  lineEnd: number;
  locator: string;
}): string {
  const where = claimLocator(item);
  return `Evidence · lines ${item.lineStart}–${item.lineEnd}${where ? ` · ${where}` : ''}`;
}

function UnmappedObservation({
  observation,
}: {
  observation: IngestionUnmappedObservation;
}) {
  const conditions = formatQualifiers(observation.qualifiers);
  const proposal = observation.proposal;
  return (
    <View className="border-border mt-3 border-t pt-3">
      <Text className="text-sm font-medium">{observation.originalTerm}</Text>
      <Text className="text-sm">
        {observation.rawValue} {observation.sourceUnit ?? ''}
      </Text>
      {observation.termOrigin === 'DERIVED_TEXT' ? (
        <Text className="text-muted-foreground mt-1 text-xs">
          This term comes from the document interpretation; confirm the
          manufacturer&apos;s original wording.
        </Text>
      ) : null}
      {conditions ? (
        <Text className="text-muted-foreground mt-1 text-xs">{conditions}</Text>
      ) : null}
      {proposal ? (
        <>
          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <Text>Mapping proposed</Text>
            </Badge>
            <Text className="text-xs">
              {proposalKindLabel(proposal)}
              {proposal.label ? ` · ${proposal.label}` : ''}
            </Text>
          </View>
          <Text className="text-muted-foreground mt-1 text-xs">
            {proposal.definition}
          </Text>
        </>
      ) : (
        <Text className="text-muted-foreground mt-2 text-xs">
          Catalog mapping needs review.
        </Text>
      )}
      <Disclosure
        summary={evidenceSummary(observation)}
        summaryClassName="text-muted-foreground"
      >
        <Excerpt text={observation.excerpt} />
      </Disclosure>
    </View>
  );
}

/** One configuration of the source: identity evidence, claims and unmapped findings. */
export function ResearchEvidenceConfiguration({
  configuration,
  requested,
  focused,
}: {
  configuration: IngestionConfigurationDraft;
  requested: boolean;
  /** Showing one selected specification: everything opens. */
  focused: boolean;
}) {
  const unmapped = configuration.unmappedObservations ?? [];
  const summary = [
    configuration.name,
    plural(
      configuration.claims.length,
      'one mapped finding',
      '{n} mapped findings',
    ),
    ...(unmapped.length
      ? [
          plural(
            unmapped.length,
            'one awaiting mapping',
            '{n} awaiting mapping',
          ),
        ]
      : []),
    ...(requested ? ['Requested'] : []),
  ].join(' · ');
  return (
    <View className="border-border rounded-lg border px-3 py-1">
      <Disclosure
        summary={summary}
        summaryClassName="text-sm font-medium"
        initiallyOpen={focused || requested}
      >
        <View className="pb-3">
          <Text className="text-muted-foreground mt-1 text-xs">
            Identity evidence · lines {configuration.identityLineStart}–
            {configuration.identityLineEnd}
          </Text>
          <Excerpt text={configuration.identityExcerpt} />
          {configuration.warnings.map((warning, index) => (
            <Text key={index} className="text-muted-foreground mt-1 text-xs">
              • {warning}
            </Text>
          ))}
          {configuration.claims.map((claim, index) => {
            const conditions = formatQualifiers(claim.qualifiers);
            return (
              <View
                key={index}
                className="border-border mt-3 border-t pt-3"
                accessibilityLabel={claim.label}
              >
                <Text className="text-sm font-medium">{claim.label}</Text>
                {claim.originalTerm ? (
                  <Text className="text-muted-foreground mt-1 text-xs">
                    Source term: {claim.originalTerm}
                  </Text>
                ) : null}
                <Text className="text-sm">
                  {researchEvidenceValue(claim)}{' '}
                  {claim.rawUnit || claim.unit || ''}
                  {claim.availability
                    ? ` · ${availabilityLabel(claim.availability)}`
                    : ''}
                </Text>
                {conditions ? (
                  <Text className="text-muted-foreground mt-1 text-xs">
                    {conditions}
                  </Text>
                ) : null}
                <Disclosure
                  summary={evidenceSummary(claim)}
                  summaryClassName="text-muted-foreground"
                  initiallyOpen={focused}
                >
                  <Excerpt text={claim.excerpt} />
                </Disclosure>
                {claim.issues.map((issue, issueIndex) => (
                  <Text
                    key={issueIndex}
                    className="text-destructive mt-1 text-xs"
                  >
                    • {issue}
                  </Text>
                ))}
              </View>
            );
          })}
          {unmapped.length ? (
            <View
              className="bg-muted mt-3 rounded-lg p-3"
              accessibilityLabel="Findings awaiting catalog mapping"
            >
              <Text className="text-sm font-medium">
                Findings awaiting catalog mapping
              </Text>
              <Text className="text-muted-foreground mt-1 text-xs">
                These source observations are retained separately from mapped
                specifications. A proposed mapping does not accept a vehicle
                specification into the catalog.
              </Text>
              {unmapped.map((observation, index) => (
                <UnmappedObservation key={index} observation={observation} />
              ))}
            </View>
          ) : null}
        </View>
      </Disclosure>
    </View>
  );
}
