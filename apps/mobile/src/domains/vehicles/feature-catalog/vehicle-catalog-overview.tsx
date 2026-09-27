import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import type {
  CatalogPage,
  VehicleConfiguration,
} from '../data/vehicle-contracts';
import type { VehicleQuestion } from '../data/vehicle-interactions';
import { PageSheet } from '../ui/page-sheet';
import { safeSourceUrl } from '../util/vehicle-display';
import {
  catalogView,
  filterAndSortConfigurations,
  modelSummaries,
  type SortMode,
  toggleShortlist,
} from './catalog-presentation';
import { VehicleCatalogCard } from './ui/vehicle-catalog-card';
import { VehicleDetailPane } from './ui/vehicle-detail-pane';
import { useVehicleCatalogDetailStore } from './vehicle-catalog-detail-store';
import { useVehicleCatalogSearchStore } from './vehicle-catalog-search-store';

export interface VehicleCatalogOverviewProps {
  /** The catalog page as the tool returned it. */
  page?: CatalogPage;
  failure?: string;
  /** The tool call finished; without a page this means the result is unusable. */
  complete: boolean;
  /** A shortlist the host shares between catalogs; local when omitted. */
  shortlist?: VehicleConfiguration[];
  onShortlistChange?: (vehicles: VehicleConfiguration[]) => void;
  onQuestion: (question: VehicleQuestion) => void;
  onCompare: (vehicles: VehicleConfiguration[]) => void;
}

/**
 * One rendered vehicle catalog (web `VehicleCatalogOverview`): filters,
 * sorting and paging over the loaded page, the comparison shortlist and the
 * detail sheet. It emits typed intentions; the host turns them into chat.
 */
export function VehicleCatalogOverview({
  page,
  failure,
  complete,
  shortlist,
  onShortlistChange,
  onQuestion,
  onCompare,
}: VehicleCatalogOverviewProps) {
  const search = useVehicleCatalogSearchStore(page);
  // The focused vehicle outlives the sheet so it can slide out with content.
  const [focused, setFocused] = useState<VehicleConfiguration>();
  const [detailOpen, setDetailOpen] = useState(false);
  const detail = useVehicleCatalogDetailStore(focused?.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('catalog-order');
  const [modelFilter, setModelFilter] = useState('all');
  const [localShortlist, setLocalShortlist] = useState<string[]>([]);
  const [shortlistMessage, setShortlistMessage] = useState('');

  const configurations = search.configurations;
  const view = page
    ? catalogView(page, configurations, search.nextSearches)
    : undefined;
  const shortlisted =
    shortlist ??
    configurations.filter((vehicle) => localShortlist.includes(vehicle.id));
  const visible = filterAndSortConfigurations(
    configurations,
    searchQuery,
    modelFilter,
    sort,
    search.highlights,
  );
  const activeFilterCount =
    Number(searchQuery.trim().length > 0) + Number(modelFilter !== 'all');

  const toggle = (vehicle: VehicleConfiguration) => {
    const change = toggleShortlist(shortlisted, vehicle);
    if (change.kind === 'full') {
      setShortlistMessage(change.message);
      return;
    }
    setShortlistMessage('');
    if (shortlist === undefined)
      setLocalShortlist(change.selected.map(({ id }) => id));
    onShortlistChange?.(change.selected);
  };

  const askAboutFocused = () => {
    if (!focused) return;
    setDetailOpen(false);
    onQuestion({ kind: 'vehicle', vehicle: focused });
  };

  const openLink = (url: string) => {
    const href = safeSourceUrl(url);
    if (href) void WebBrowser.openBrowserAsync(href);
  };

  return (
    <>
      <VehicleCatalogCard
        page={view}
        failure={failure}
        complete={complete}
        summaries={search.highlights}
        summariesLoading={search.highlightsLoading}
        summariesFailed={search.highlightsFailed}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sort={sort}
        onSortChange={setSort}
        modelFilter={modelFilter}
        // Selecting the active model family again shows every family.
        onModelChange={(model) =>
          setModelFilter((current) => (current === model ? 'all' : model))
        }
        modelSummaries={modelSummaries(configurations)}
        visibleConfigurations={visible}
        shortlisted={shortlisted}
        activeFilterCount={activeFilterCount}
        shortlistMessage={shortlistMessage}
        nextPageLoading={search.nextPageLoading}
        nextPageFailed={search.nextPageFailed}
        onVehicleSelected={(vehicle) => {
          setFocused(vehicle);
          setDetailOpen(true);
        }}
        onShortlistToggled={toggle}
        onCompare={() => {
          if (shortlisted.length >= 2) onCompare(shortlisted);
        }}
        onRetrySummaries={search.retryHighlights}
        onClearFilters={() => {
          setSearchQuery('');
          setModelFilter('all');
        }}
        onNextPage={search.loadNextPage}
      />
      <PageSheet visible={detailOpen} onClose={() => setDetailOpen(false)}>
        {focused ? (
          <VehicleDetailPane
            vehicle={focused}
            comparison={detail.detail}
            loading={detail.detailLoading}
            failed={detail.detailFailed}
            onClose={() => setDetailOpen(false)}
            onRetry={detail.retry}
            onAsk={askAboutFocused}
            onOpenLink={openLink}
          />
        ) : null}
      </PageSheet>
    </>
  );
}
