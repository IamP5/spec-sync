import {
  ArrowRight,
  FileText,
  Layers,
  type LucideIcon,
  Users,
} from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { View } from 'react-native';

import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import type { ResearchSnapshot } from '../../data/research-contracts';
import { researchIsActive } from '../../data/research-contracts';
import {
  researchComparisonRows,
  type ResearchEvidenceFocus,
  researchSelectedIndex,
} from '../../data/research-presentation';
import { FilterChip } from '../../ui/filter-chip';
import { ResearchClaimValues } from './research-claim-values';
import { ResearchCompareTable } from './research-compare-table';
import { ResearchJournalHeader } from './research-journal-header';

/** Attributes shown before "See all". */
const HIGHLIGHTS = 6;

function Step({
  icon,
  eyebrow,
  last = false,
  children,
}: {
  icon: LucideIcon;
  eyebrow: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View
          className="border-border bg-background size-7 items-center justify-center rounded-full border"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon as={icon} className="text-muted-foreground size-3.5" />
        </View>
        {last ? null : <View className="bg-border w-px flex-1" />}
      </View>
      <View className="flex-1 pb-6">
        <Text className="text-muted-foreground text-xs uppercase tracking-widest">
          {eyebrow}
        </Text>
        {children}
      </View>
    </View>
  );
}

/**
 * The source-backed research journal (web `ResearchComparisonPane`): the
 * header, where the data comes from, what is known so far per version, the
 * version comparison and the people researching the same vehicle. Every
 * interaction is an intention for the owner; the chosen version, the
 * expansion and the comparison are local visual state.
 */
export function ResearchJournalPane({
  research,
  updating,
  error,
  onEvidence,
  onPeople,
  onRefresh,
}: {
  research: ResearchSnapshot;
  updating: boolean;
  error: string;
  onEvidence: (focus: ResearchEvidenceFocus | null) => void;
  onPeople: () => void;
  onRefresh: () => void;
}) {
  const [selected, setSelected] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [comparing, setComparing] = useState(false);
  const rows = researchComparisonRows(research);
  const selectedIndex = researchSelectedIndex(research, selected);
  const configuration = research.configurations[selectedIndex];
  const findings = research.configurations.reduce(
    (count, item) => count + item.claims.length,
    0,
  );
  const unmapped = research.configurations.reduce(
    (count, item) => count + (item.unmappedObservations?.length ?? 0),
    0,
  );
  const visibleRows = expanded ? rows : rows.slice(0, HIGHLIGHTS);
  const versions = research.configurations.length;
  const active = researchIsActive(research);

  return (
    <View className="w-full">
      <ResearchJournalHeader research={research} error={error} />
      <View className="mt-5">
        <Step icon={FileText} eyebrow="01 / The origin">
          <Text className="mt-2 text-lg font-semibold">
            {research.source
              ? 'The source is preserved'
              : 'Looking for where the data comes from'}
          </Text>
          <Text className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {research.source?.title ||
              'The research looks for documents matching the requested vehicle and market.'}
          </Text>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 min-h-11 self-start rounded-full"
            accessibilityRole="button"
            accessibilityLabel="See evidence"
            onPress={() => onEvidence(null)}
          >
            <Icon as={FileText} className="size-4" />
            <Text>See evidence</Text>
            <Icon as={ArrowRight} className="size-4" />
          </Button>
        </Step>
        <Step icon={Layers} eyebrow="02 / What we know so far">
          <Text className="mt-2 text-lg font-semibold">
            {versions
              ? 'Versions and the details that matter.'
              : 'The first results appear here.'}
          </Text>
          <Text className="text-muted-foreground mt-1 text-xs">
            {findings} data points found · {versions} versions · {unmapped}{' '}
            observations without a match in the catalog
          </Text>
          {versions ? (
            <>
              <Text className="text-muted-foreground mt-3 text-xs leading-relaxed">
                {research.status === 'PUBLISHED'
                  ? 'The publication may contain only part of the information below.'
                  : 'Data extracted from the source, not yet accepted into the catalog.'}{' '}
                Reliability has not been calibrated. Check the conditions and
                the warnings.
              </Text>
              <View
                className="mt-3 flex-row flex-wrap gap-x-2"
                accessibilityLabel="Version being viewed"
              >
                {research.configurations.map((item, index) => (
                  <FilterChip
                    key={item.name}
                    label={`${index + 1} ${item.name}`}
                    selected={selectedIndex === index}
                    accessibilityLabel={`Version ${item.name}`}
                    onPress={() => setSelected(item.name)}
                  />
                ))}
              </View>
              {configuration ? (
                <Text className="border-border mt-3 border-b pb-2 text-base font-semibold">
                  {research.request.model} {configuration.name}
                </Text>
              ) : null}
              <View>
                {visibleRows.map((row) => (
                  <View key={row.code} className="border-border border-b py-2">
                    <Text className="text-muted-foreground text-xs">
                      {row.label}
                    </Text>
                    <ResearchClaimValues
                      claims={row.cells[selectedIndex] ?? []}
                      onEvidence={(attribute) =>
                        onEvidence({
                          configuration: configuration?.name ?? '',
                          attribute,
                        })
                      }
                    />
                  </View>
                ))}
              </View>
              {rows.length > HIGHLIGHTS ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 min-h-11 self-start"
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={
                    expanded
                      ? 'Show highlights'
                      : `See all ${rows.length} attributes`
                  }
                  onPress={() => setExpanded(!expanded)}
                >
                  <Text>
                    {expanded
                      ? 'Show highlights'
                      : `See all ${rows.length} attributes`}
                  </Text>
                </Button>
              ) : null}
              {rows.length ? null : (
                <Text className="text-muted-foreground mt-3 text-xs">
                  There are no normalised attributes yet. The original
                  observations are in the evidence.
                </Text>
              )}
              {versions > 1 ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 min-h-11 self-start"
                  accessibilityRole="button"
                  accessibilityState={{ expanded: comparing }}
                  accessibilityLabel={
                    comparing ? 'Close comparison' : 'Compare versions'
                  }
                  onPress={() => setComparing(!comparing)}
                >
                  <Text>
                    {comparing ? 'Close comparison' : 'Compare versions'}
                  </Text>
                  <Icon as={ArrowRight} className="size-4" />
                </Button>
              ) : null}
            </>
          ) : null}
          {research.warnings.length || unmapped ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 min-h-11 self-start"
              accessibilityRole="button"
              accessibilityLabel="See warnings and pending information"
              onPress={() => onEvidence(null)}
            >
              <Text>See warnings and pending information</Text>
              <Icon as={ArrowRight} className="size-4" />
            </Button>
          ) : null}
        </Step>
        <Step icon={Users} eyebrow="Research brings people together" last>
          <Text className="text-muted-foreground mt-2 text-xs leading-relaxed">
            See who else is interested in this vehicle. Your conversation
            history stays private.
          </Text>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 min-h-11 self-start"
            accessibilityRole="button"
            accessibilityLabel="Interested people"
            onPress={onPeople}
          >
            <Text>Interested people</Text>
            <Icon as={ArrowRight} className="size-4" />
          </Button>
        </Step>
      </View>
      {comparing && versions > 1 ? (
        <ResearchCompareTable
          research={research}
          rows={rows}
          onEvidence={onEvidence}
        />
      ) : null}
      {!active || error ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 min-h-11 self-start"
          accessibilityRole="button"
          accessibilityLabel="Refresh research"
          disabled={updating}
          onPress={onRefresh}
        >
          <Text>{updating ? 'Updating…' : 'Refresh research'}</Text>
        </Button>
      ) : null}
    </View>
  );
}
