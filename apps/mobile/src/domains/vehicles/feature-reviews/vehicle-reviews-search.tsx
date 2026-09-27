import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import type {
  VehicleQuestion,
  VehicleReviewsContext,
} from '../data/vehicle-interactions';
import { safeSourceUrl } from '../util/vehicle-display';
import {
  discoverQuestion,
  failedVehicles,
  filterReviews,
  type ReviewFilters,
  reviewMediaOptions,
  reviewsQuestion,
  toggleReviewSelection,
} from './reviews-presentation';
import { VehicleReviewsPane } from './ui/vehicle-reviews-pane';
import { useVehicleReviewsSearchStore } from './vehicle-reviews-search-store';

/**
 * The related reviews of one comparison row (web `VehicleReviewsSearch`),
 * shown in a sheet. The host mounts one instance per opened row, so the
 * filters and the selection start fresh every time.
 */
export function VehicleReviewsSearch({
  context,
  onClose,
  onQuestion,
}: {
  context: VehicleReviewsContext;
  onClose: () => void;
  onQuestion: (question: VehicleQuestion) => void;
}) {
  const store = useVehicleReviewsSearchStore({
    configurationIds: context.comparison.configurations.map(({ id }) => id),
    attributeCode: context.row.attribute.code,
  });
  const [filters, setFilters] = useState<ReviewFilters>({
    vehicle: context.configurationId ?? '',
    media: '',
    query: '',
  });
  const [selected, setSelected] = useState<string[]>([]);
  const items = store.batch?.items ?? [];
  const selectedReviews = items.filter(({ id }) => selected.includes(id));

  return (
    <VehicleReviewsPane
      context={context}
      filters={filters}
      onFiltersChange={setFilters}
      loading={store.loading}
      failed={store.failed}
      limited={!!store.batch?.limited}
      failedNames={failedVehicles(
        context.comparison,
        store.batch?.failedConfigurationIds ?? [],
      )}
      items={items}
      visible={filterReviews(items, filters)}
      selected={selected}
      selectedReviews={selectedReviews}
      media={reviewMediaOptions(items)}
      onClose={onClose}
      onRetry={store.retry}
      onToggle={(id) => setSelected((ids) => toggleReviewSelection(ids, id))}
      onClearFilters={() => setFilters({ vehicle: '', media: '', query: '' })}
      onAsk={() => {
        if (selectedReviews.length)
          onQuestion(reviewsQuestion(context, selectedReviews));
      }}
      onDiscover={() => onQuestion(discoverQuestion(context, filters.vehicle))}
      onOpenLink={(url) => {
        const href = safeSourceUrl(url);
        if (href) void WebBrowser.openBrowserAsync(href);
      }}
    />
  );
}
