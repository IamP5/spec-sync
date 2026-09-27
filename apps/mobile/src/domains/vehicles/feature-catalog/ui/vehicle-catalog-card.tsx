import { CarFront, GalleryHorizontal, List } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '../../../../design-system/components/ui/icon';
import { Skeleton } from '../../../../design-system/components/ui/skeleton';
import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import type {
  CatalogPage,
  Comparison,
  VehicleConfiguration,
} from '../../data/vehicle-contracts';
import {
  CATALOG_PAGE_STEP,
  type CatalogLayout,
  defaultCatalogLayout,
  type ModelSummary,
  type SortMode,
} from '../catalog-presentation';
import { VehicleCatalogFilters } from './vehicle-catalog-filters';
import { VehicleCatalogFooter } from './vehicle-catalog-footer';
import { VehicleCatalogList } from './vehicle-catalog-list';
import { VehicleCatalogStrip } from './vehicle-catalog-strip';

export interface VehicleCatalogCardProps {
  page?: CatalogPage;
  failure?: string;
  complete: boolean;
  summaries?: Comparison;
  summariesLoading: boolean;
  summariesFailed: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  modelFilter: string;
  onModelChange: (model: string) => void;
  modelSummaries: ModelSummary[];
  visibleConfigurations: VehicleConfiguration[];
  shortlisted: VehicleConfiguration[];
  activeFilterCount: number;
  shortlistMessage: string;
  nextPageLoading: boolean;
  nextPageFailed: boolean;
  onVehicleSelected: (vehicle: VehicleConfiguration) => void;
  onShortlistToggled: (vehicle: VehicleConfiguration) => void;
  onCompare: () => void;
  onRetrySummaries: () => void;
  onClearFilters: () => void;
  onNextPage: () => void;
}

/**
 * A catalog page attached to the reply (web `VehicleCatalogCard`): a caption
 * with the counts, one filter row, the configurations as a card strip or a
 * flush list (the reader can switch; large pages open as the list), and a
 * footer with the paging and the shortlist. Only a step of the page is
 * rendered at first so a large catalog never floods the transcript.
 */
export function VehicleCatalogCard(props: VehicleCatalogCardProps) {
  const { page, failure, complete } = props;
  if (page) return <LoadedCatalog {...props} page={page} />;
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
          ? 'This saved catalog result is no longer compatible. Ask the assistant to open the catalog again.'
          : 'Loading the vehicle catalog…'}
      </Text>
      {complete ? null : <Skeleton className="h-24 w-full rounded-xl" />}
    </View>
  );
}

function LoadedCatalog({
  page,
  summaries,
  summariesLoading,
  summariesFailed,
  searchQuery,
  onSearchChange,
  sort,
  onSortChange,
  modelFilter,
  onModelChange,
  modelSummaries,
  visibleConfigurations,
  shortlisted,
  activeFilterCount,
  shortlistMessage,
  nextPageLoading,
  nextPageFailed,
  onVehicleSelected,
  onShortlistToggled,
  onCompare,
  onRetrySummaries,
  onClearFilters,
  onNextPage,
}: VehicleCatalogCardProps & { page: CatalogPage }) {
  const pageSize = page.items.length;
  // The layout follows the page size until the reader switches it.
  const [chosenLayout, setChosenLayout] = useState<CatalogLayout>();
  const layout = chosenLayout ?? defaultCatalogLayout(pageSize);
  // A page that grows (a next page loaded in place) reveals exactly what it
  // gained, so the loaded configurations never hide behind "show more".
  const [paging, setPaging] = useState({
    size: pageSize,
    limit: CATALOG_PAGE_STEP,
  });
  if (paging.size !== pageSize)
    setPaging({
      size: pageSize,
      limit: paging.limit + Math.max(0, pageSize - paging.size),
    });
  const limit = paging.limit;
  const shown = visibleConfigurations.slice(0, limit);
  const hidden = Math.max(0, visibleConfigurations.length - limit);
  const step = Math.min(CATALOG_PAGE_STEP, hidden);
  const nextPageSize = page.hasMore && !hidden ? page.limit : 0;
  const shortlistedIds = new Set(shortlisted.map(({ id }) => id));
  const showMore = () =>
    setPaging((current) => ({ ...current, limit: current.limit + step }));

  return (
    <View className="w-full py-1" accessibilityLabel="Vehicle catalog">
      <View className="flex-row items-center gap-2">
        <Icon as={CarFront} className="text-muted-foreground size-4" />
        <Text className="flex-1 text-sm font-medium" numberOfLines={1}>
          Vehicle catalog
        </Text>
        <View
          className="bg-muted flex-row rounded-full p-0.5"
          accessibilityLabel="Catalog layout"
        >
          <LayoutToggle
            icon={GalleryHorizontal}
            label="Show as cards"
            selected={layout === 'strip'}
            onPress={() => setChosenLayout('strip')}
          />
          <LayoutToggle
            icon={List}
            label="Show as list"
            selected={layout === 'list'}
            onPress={() => setChosenLayout('list')}
          />
        </View>
      </View>
      <Text
        className="text-muted-foreground mt-0.5 text-xs"
        accessibilityLiveRegion="polite"
      >
        Showing {shown.length} of {visibleConfigurations.length} loaded
        {page.hasMore ? ' · more in the catalog' : ''}
      </Text>

      <VehicleCatalogFilters
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        modelFilter={modelFilter}
        modelSummaries={modelSummaries}
        onModelChange={onModelChange}
        sort={sort}
        onSortChange={onSortChange}
      />

      {summariesFailed ? (
        <View className="mt-2 flex-row flex-wrap items-center gap-x-1">
          <Text className="text-muted-foreground text-xs">
            Highlights could not be loaded; catalog identities remain available.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry highlights"
            className="min-h-11 justify-center"
            onPress={onRetrySummaries}
          >
            <Text className="text-xs underline">Retry highlights</Text>
          </Pressable>
        </View>
      ) : null}

      {shown.length ? (
        <View className="mt-3">
          {layout === 'strip' ? (
            <VehicleCatalogStrip
              vehicles={shown}
              summaries={summaries}
              summariesLoading={summariesLoading}
              shortlistedIds={shortlistedIds}
              hidden={hidden}
              nextPageSize={nextPageSize}
              nextPageLoading={nextPageLoading}
              onVehicleSelected={onVehicleSelected}
              onShortlistToggled={onShortlistToggled}
              onMore={showMore}
              onNextPage={onNextPage}
            />
          ) : (
            <VehicleCatalogList
              vehicles={shown}
              summaries={summaries}
              summariesLoading={summariesLoading}
              shortlistedIds={shortlistedIds}
              onVehicleSelected={onVehicleSelected}
              onShortlistToggled={onShortlistToggled}
            />
          )}
        </View>
      ) : (
        <View className="items-center py-6">
          <Text className="text-muted-foreground text-center text-sm">
            No configurations match.
          </Text>
          {activeFilterCount ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear filters"
              className="min-h-11 justify-center"
              onPress={onClearFilters}
            >
              <Text className="text-sm underline">Clear filters</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <VehicleCatalogFooter
        step={step}
        expanded={limit > CATALOG_PAGE_STEP}
        nextPageSize={nextPageSize}
        nextPageLoading={nextPageLoading}
        nextPageFailed={nextPageFailed}
        shortlisted={shortlisted}
        onMore={showMore}
        onLess={() =>
          setPaging((current) => ({ ...current, limit: CATALOG_PAGE_STEP }))
        }
        onNextPage={onNextPage}
        onCompare={onCompare}
      />
      {shortlistMessage ? (
        <Text
          accessibilityLiveRegion="polite"
          className="text-muted-foreground mt-1 text-xs"
        >
          {shortlistMessage}
        </Text>
      ) : null}
    </View>
  );
}

function LayoutToggle({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: typeof List;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      // The pill stays as small as the web toggle; the touch target keeps 44pt.
      hitSlop={6}
      className={cn(
        'size-8 items-center justify-center rounded-full',
        selected && 'bg-background shadow-sm shadow-black/10',
      )}
      onPress={onPress}
    >
      <Icon
        as={icon}
        className={cn(
          'size-4',
          selected ? 'text-foreground' : 'text-muted-foreground',
        )}
      />
    </Pressable>
  );
}
