import { View } from 'react-native';

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
 * The one filter row of a catalog (web `VehicleCatalogCard` header): a text
 * search over the loaded page, a chip per model family and the order.
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
  return (
    <View className="border-border gap-1 border-b pb-2">
      <View className="flex-row items-center gap-2">
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
            className="h-11 max-w-40"
          >
            <SelectValue placeholder="Order by" className="text-xs" />
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
      <View className="flex-row flex-wrap gap-x-1.5">
        <FilterChip
          label="All"
          selected={modelFilter === 'all'}
          accessibilityLabel="All models"
          onPress={() => onModelChange('all')}
        />
        {modelSummaries.map((family) => (
          <FilterChip
            key={family.model}
            label={family.model}
            count={family.configurationCount}
            selected={modelFilter === family.model}
            accessibilityLabel={`${family.model}, ${family.configurationCount} configurations`}
            onPress={() => onModelChange(family.model)}
          />
        ))}
      </View>
    </View>
  );
}
