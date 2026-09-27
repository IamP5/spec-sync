import { FlatList, View } from 'react-native';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../design-system/components/ui/select';
import { FilterChip } from '../../ui/filter-chip';
import { SearchField } from '../../ui/search-field';
import {
  type ModelSummary,
  SORT_OPTIONS,
  type SortMode,
  sortMode,
} from '../catalog-presentation';

/**
 * The filters of a catalog (web `VehicleCatalogCard` header): a text search
 * over the loaded page beside a quiet order pill, then one sideways-scrolling
 * row with a chip per model family, so many families never stack up.
 */
export function VehicleCatalogFilters({
  searchQuery,
  onSearchChange,
  modelFilter,
  modelSummaries,
  onModelChange,
  sort,
  onSortChange,
}: {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  modelFilter: string;
  modelSummaries: ModelSummary[];
  onModelChange: (model: string) => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
}) {
  const selectedSort = {
    value: sort,
    label:
      SORT_OPTIONS.find((option) => option.value === sort)?.label ??
      'Catalog order',
  };
  const families: FamilyChip[] = [
    { model: 'all', label: 'All', accessibilityLabel: 'All models' },
    ...modelSummaries.map((family) => ({
      model: family.model,
      label: family.model,
      count: family.configurationCount,
      accessibilityLabel: `${family.model}, ${family.configurationCount} configurations`,
    })),
  ];
  return (
    <View className="border-border mt-2 border-b pb-1">
      <View className="flex-row items-center gap-1">
        <SearchField
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Search vehicles…"
          accessibilityLabel="Search catalog"
        />
        <Select
          value={selectedSort}
          onValueChange={(option) => {
            if (option) onSortChange(sortMode(option.value));
          }}
        >
          <SelectTrigger
            accessibilityLabel={`Order by: ${selectedSort.label}`}
            className="active:bg-accent h-11 shrink-0 gap-1 rounded-full border-0 bg-transparent px-3 shadow-none dark:bg-transparent"
          >
            <SelectValue
              placeholder="Order by"
              className="text-muted-foreground text-xs"
            />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                label={option.label}
              />
            ))}
          </SelectContent>
        </Select>
      </View>
      <FlatList
        horizontal
        data={families}
        keyExtractor={familyKey}
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-1 px-4"
        className="-mx-4"
        accessibilityLabel="Model families"
        renderItem={({ item }) => (
          <FilterChip
            label={item.label}
            count={item.count}
            selected={modelFilter === item.model}
            accessibilityLabel={item.accessibilityLabel}
            onPress={() => onModelChange(item.model)}
          />
        )}
      />
    </View>
  );
}

interface FamilyChip {
  model: string;
  label: string;
  count?: number;
  accessibilityLabel: string;
}

function familyKey(chip: FamilyChip) {
  return chip.model;
}
