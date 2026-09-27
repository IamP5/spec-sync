import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import type { VehicleReviewsContext } from '../../data/vehicle-interactions';
import { FilterChip } from '../../ui/filter-chip';
import { SearchField } from '../../ui/search-field';
import {
  type ReviewFilters,
  reviewSpecification,
} from '../reviews-presentation';

/**
 * The top of the reviews sheet: the specification each vehicle reports for
 * the attribute (collapsed), the text search and the vehicle and format
 * filters.
 */
export function VehicleReviewsFilters({
  context,
  filters,
  media,
  onFiltersChange,
}: {
  context: VehicleReviewsContext;
  filters: ReviewFilters;
  media: string[];
  onFiltersChange: (filters: ReviewFilters) => void;
}) {
  const [specificationsOpen, setSpecificationsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = Number(!!filters.vehicle) + Number(!!filters.media);
  const configurations = context.comparison.configurations;
  return (
    <View className="gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Specifications and context"
        accessibilityState={{ expanded: specificationsOpen }}
        className="min-h-11 flex-row items-center gap-1"
        onPress={() => setSpecificationsOpen(!specificationsOpen)}
      >
        <Icon
          as={specificationsOpen ? ChevronDown : ChevronRight}
          className="text-foreground size-4"
        />
        <Text className="text-sm font-medium">Specifications and context</Text>
      </Pressable>
      {specificationsOpen ? (
        <View className="gap-2" accessibilityLabel="Specification summary">
          {configurations.map((configuration) => (
            <View
              key={configuration.id}
              className="border-border bg-muted/15 rounded-lg border p-3"
            >
              <Text className="text-muted-foreground text-xs">
                {configuration.brand} {configuration.model} {configuration.name}{' '}
                · {configuration.modelYear}
              </Text>
              <Text className="mt-1 text-sm font-medium">
                {reviewSpecification(context, configuration.id)}
              </Text>
            </View>
          ))}
          <Text className="text-muted-foreground text-xs">
            Reports complement the specification sheet. The context and the
            reviewed version may differ.
          </Text>
        </View>
      ) : null}
      <View className="flex-row items-center gap-2">
        <SearchField
          value={filters.query}
          onChangeText={(query) => onFiltersChange({ ...filters, query })}
          placeholder="Search the reports…"
          accessibilityLabel="Search the reports"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Filters${activeFilters ? ` (${activeFilters})` : ''}`}
          accessibilityState={{ expanded: filtersOpen }}
          className="border-border min-h-11 justify-center rounded-md border px-3"
          onPress={() => setFiltersOpen(!filtersOpen)}
        >
          <Text className="text-sm font-medium">
            Filters{activeFilters ? ` (${activeFilters})` : ''}
          </Text>
        </Pressable>
      </View>
      {filtersOpen ? (
        <View className="gap-1">
          <Text className="text-xs font-medium">Vehicle</Text>
          <View className="flex-row flex-wrap gap-x-1.5">
            <FilterChip
              label="All vehicles"
              selected={!filters.vehicle}
              onPress={() => onFiltersChange({ ...filters, vehicle: '' })}
            />
            {configurations.map((configuration) => (
              <FilterChip
                key={configuration.id}
                label={`${configuration.model} · ${configuration.name}`}
                accessibilityLabel={`${configuration.brand} ${configuration.model} ${configuration.name}`}
                selected={filters.vehicle === configuration.id}
                onPress={() =>
                  onFiltersChange({ ...filters, vehicle: configuration.id })
                }
              />
            ))}
          </View>
          <Text className="text-xs font-medium">Format</Text>
          <View className="flex-row flex-wrap gap-x-1.5">
            <FilterChip
              label="All formats"
              selected={!filters.media}
              onPress={() => onFiltersChange({ ...filters, media: '' })}
            />
            {media.map((type) => (
              <FilterChip
                key={type}
                label={type}
                selected={filters.media === type}
                onPress={() => onFiltersChange({ ...filters, media: type })}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
