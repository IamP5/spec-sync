import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Modal } from 'react-native';

import type { Comparison } from '../data/vehicle-contracts';
import type {
  VehicleQuestion,
  VehicleReviewsContext,
} from '../data/vehicle-interactions';
import { VehicleReviewsSearch } from '../feature-reviews';
import { safeSourceUrl } from '../util/vehicle-display';
import { type ComparisonRow, filterRows } from './comparison-presentation';
import { VehicleComparisonCard } from './ui/vehicle-comparison-card';
import { useVehicleComparisonLookupStore } from './vehicle-comparison-lookup-store';

export interface VehicleComparisonOverviewProps {
  comparison?: Comparison;
  failure?: string;
  complete: boolean;
  /** Questions (reviews, follow-ups) need a conversation to go to. */
  questionsEnabled?: boolean;
  onQuestion: (question: VehicleQuestion) => void;
}

/**
 * One rendered comparison (web `VehicleComparisonOverview`): filters over
 * the attributes, photos for configurations saved without one, the reviews
 * sheet of a row, and the "analyse for my use" follow-up intention.
 */
export function VehicleComparisonOverview({
  comparison,
  failure,
  complete,
  questionsEnabled = true,
  onQuestion,
}: VehicleComparisonOverviewProps) {
  const lookup = useVehicleComparisonLookupStore(
    (comparison?.configurations ?? [])
      .filter(({ primaryImage }) => !primaryImage)
      .map(({ id }) => id),
  );
  const [query, setQuery] = useState('');
  const [differencesOnly, setDifferencesOnly] = useState(false);
  // The context outlives the sheet so it can slide out with its content;
  // `reviewsKey` gives every opened row a fresh search.
  const [reviewContext, setReviewContext] = useState<VehicleReviewsContext>();
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [reviewsKey, setReviewsKey] = useState(0);
  const rows = filterRows(comparison, differencesOnly, query);

  const openReviews = (row: ComparisonRow, configurationId?: string) => {
    if (!comparison) return;
    setReviewContext({ comparison, row, configurationId });
    setReviewsKey((key) => key + 1);
    setReviewsOpen(true);
  };

  return (
    <>
      <VehicleComparisonCard
        result={comparison}
        images={lookup.images}
        failure={failure}
        complete={complete}
        questionsEnabled={questionsEnabled}
        query={query}
        onQueryChange={setQuery}
        differencesOnly={differencesOnly}
        onDifferencesChange={setDifferencesOnly}
        rows={rows}
        onClearFilters={() => {
          setQuery('');
          setDifferencesOnly(false);
        }}
        onReviews={openReviews}
        onFollowUp={() => {
          if (comparison)
            onQuestion({
              kind: 'comparison',
              configurations: comparison.configurations,
              attributeCodes: rows.map((row) => row.attribute.code),
            });
        }}
        onOpenLink={(url) => {
          const href = safeSourceUrl(url);
          if (href) void WebBrowser.openBrowserAsync(href);
        }}
      />
      <Modal
        visible={reviewsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReviewsOpen(false)}
      >
        {reviewContext ? (
          <VehicleReviewsSearch
            key={reviewsKey}
            context={reviewContext}
            onClose={() => setReviewsOpen(false)}
            onQuestion={(question) => {
              setReviewsOpen(false);
              onQuestion(question);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}
