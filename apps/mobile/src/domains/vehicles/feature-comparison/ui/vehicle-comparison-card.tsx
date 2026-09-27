import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '../../../../design-system/components/ui/button';
import { Skeleton } from '../../../../design-system/components/ui/skeleton';
import { Text } from '../../../../design-system/components/ui/text';
import type {
  Comparison,
  VehicleImageMetadata,
} from '../../data/vehicle-contracts';
import { FilterChip } from '../../ui/filter-chip';
import { SearchField } from '../../ui/search-field';
import {
  type ComparisonRow,
  differingAttributeIds,
  hiddenRowsLabel,
  rowCounts,
} from '../comparison-presentation';
import { VehicleComparisonLegend } from './vehicle-comparison-legend';
import { VehicleComparisonRow } from './vehicle-comparison-row';

/** Rows rendered at first, so a long comparison stays short in the transcript. */
const ROW_STEP = 12;

export interface VehicleComparisonCardProps {
  result?: Comparison;
  images?: Record<string, VehicleImageMetadata | null>;
  failure?: string;
  complete: boolean;
  questionsEnabled: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  differencesOnly: boolean;
  onDifferencesChange: (differencesOnly: boolean) => void;
  rows: ComparisonRow[];
  onClearFilters: () => void;
  onReviews: (row: ComparisonRow, configurationId?: string) => void;
  onFollowUp: () => void;
  onOpenLink: (url: string) => void;
}

/**
 * The comparison as an attribute list attached to the reply (web
 * `VehicleComparisonCard`): the vehicles numbered once in a legend, every
 * attribute one hairline row with the values as numbered chips, and the
 * sources per row.
 */
export function VehicleComparisonCard(props: VehicleComparisonCardProps) {
  const { result, failure, complete } = props;
  if (result) return <LoadedComparison {...props} result={result} />;
  if (failure)
    return (
      <Text accessibilityRole="alert" className="py-1 text-sm">
        {failure}
      </Text>
    );
  return (
    <View className="gap-3 py-1" accessibilityLiveRegion="polite">
      <Text className="text-muted-foreground text-sm">
        {complete
          ? 'This comparison could not be displayed. Ask the assistant to try again.'
          : 'Looking up specifications and sources…'}
      </Text>
      {complete ? null : <Skeleton className="h-24 w-full rounded-xl" />}
    </View>
  );
}

function LoadedComparison({
  result,
  images,
  questionsEnabled,
  query,
  onQueryChange,
  differencesOnly,
  onDifferencesChange,
  rows,
  onClearFilters,
  onReviews,
  onFollowUp,
  onOpenLink,
}: VehicleComparisonCardProps & { result: Comparison }) {
  const count = result.configurations.length;
  // Numbers only make sense against other vehicles.
  const numbered = count > 1;
  const differing = differingAttributeIds(result);
  const counts = rowCounts(result);
  const hiddenLabel = hiddenRowsLabel(counts.hidden);
  const [named, setNamed] = useState<ReadonlySet<string>>(new Set());
  const [limit, setLimit] = useState(ROW_STEP);
  const shownRows = rows.slice(0, limit);
  const toggleName = (configurationId: string) =>
    setNamed((current) => {
      const next = new Set(current);
      if (!next.delete(configurationId)) next.add(configurationId);
      return next;
    });

  return (
    <View className="w-full py-1" accessibilityLabel="Vehicle comparison">
      <Text className="text-muted-foreground text-xs">
        <Text className="text-foreground text-sm font-medium">
          {numbered ? 'Specification comparison' : 'Vehicle specifications'}
        </Text>
        {' · '}
        {count === 1 ? 'one vehicle' : `${count} vehicles`}
        {' · '}
        {rows.length} of {counts.reported} items
        {hiddenLabel ? ` · ${hiddenLabel}` : ''}
      </Text>

      <VehicleComparisonLegend
        configurations={result.configurations}
        images={images}
        numbered={numbered}
        named={named}
        onToggleName={toggleName}
      />

      <View className="border-border flex-row flex-wrap items-center gap-2 border-b pb-2">
        <SearchField
          value={query}
          onChangeText={onQueryChange}
          placeholder="Filter specifications…"
          accessibilityLabel="Filter specifications"
          clearLabel="Clear filter"
        />
        {numbered ? (
          <FilterChip
            label="Differences only"
            selected={differencesOnly}
            onPress={() => onDifferencesChange(!differencesOnly)}
          />
        ) : null}
      </View>

      {shownRows.length ? (
        <View accessibilityRole="list">
          {shownRows.map((row, index) => (
            <View
              key={row.attribute.id}
              className={index > 0 ? 'border-border border-t' : undefined}
            >
              <VehicleComparisonRow
                row={row}
                configurations={result.configurations}
                numbered={numbered}
                differs={differing.has(row.attribute.id)}
                named={named}
                questionsEnabled={questionsEnabled}
                onToggleName={toggleName}
                onReviews={onReviews}
                onOpenLink={onOpenLink}
              />
            </View>
          ))}
        </View>
      ) : counts.reported === 0 ? (
        <Text className="text-muted-foreground py-6 text-center text-sm">
          None of these items is reported for these vehicles. Missing data does
          not mean the equipment is absent.
        </Text>
      ) : (
        <View className="items-center py-6">
          <Text className="text-muted-foreground text-center text-sm">
            No item matches the filters.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear filters"
            className="min-h-11 justify-center"
            onPress={onClearFilters}
          >
            <Text className="text-sm underline">Clear filters</Text>
          </Pressable>
        </View>
      )}
      {rows.length > limit ? (
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 self-start"
          accessibilityLabel={`Show all ${rows.length} items`}
          onPress={() => setLimit(rows.length)}
        >
          <Text className="text-xs">Show all {rows.length} items</Text>
        </Button>
      ) : null}

      <View className="border-border mt-2 gap-2 border-t pt-2">
        <Text className="text-muted-foreground text-xs">
          Optional items depend on the package purchased. Unreported data and
          conflicts stay explicit.
        </Text>
        {questionsEnabled ? (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 self-end rounded-full"
            accessibilityLabel="Analyse for my use"
            onPress={onFollowUp}
          >
            <Text className="text-xs">Analyse for my use ↗</Text>
          </Button>
        ) : null}
      </View>
    </View>
  );
}
