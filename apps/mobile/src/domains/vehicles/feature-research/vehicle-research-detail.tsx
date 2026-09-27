import { openBrowserAsync } from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '../../../design-system/components/ui/button';
import { Text } from '../../../design-system/components/ui/text';
import type { IngestionRunSummary } from '../data/ingestion-contracts';
import {
  type ResearchEvidenceFocus,
  researchIsReviewable,
} from '../data/research-presentation';
import { VehicleIngestionReviewDetail } from '../feature-ingestion';
import { DetailSheet } from '../ui/detail-sheet';
import { safeSourceUrl } from '../util/vehicle-display';
import { useResearchDetailStore } from './research-detail-store';
import { ResearchPeopleDetail } from './research-people-detail';
import { ResearchEvidencePane } from './ui/research-evidence-pane';
import { ResearchJournalPane } from './ui/research-journal-pane';

type Details =
  | { kind: 'evidence'; focus: ResearchEvidenceFocus | null }
  | { kind: 'people' };

/**
 * One private research request as a chat card (web `VehicleResearchDetail`):
 * the journal, polled while the shared work runs; the evidence and the
 * interested people in sheets; and, once a draft exists, its review and
 * publication. Everything is read from the authenticated snapshot endpoint,
 * never from the tool output that announced the request.
 */
export function VehicleResearchDetail({
  requestId,
  reviewInitiallyOpen = false,
  onRequestIdChange,
}: {
  requestId: string;
  reviewInitiallyOpen?: boolean;
  /** A new interpretation of the saved source is followed under a new id. */
  onRequestIdChange?: (id: string) => void;
}) {
  const store = useResearchDetailStore(requestId, onRequestIdChange);
  const research = store.research;
  // The reader's place is separate from the research lifecycle, so a
  // completion changes the status without moving the reader.
  const [reviewOpen, setReviewOpen] = useState(reviewInitiallyOpen);
  const [details, setDetails] = useState<{
    id: string;
    value: Details;
  } | null>(null);
  // Details belong to the request they were opened on.
  const open = research && details?.id === research.id ? details.value : null;

  const openDetails = (value: Details) => {
    if (research) setDetails({ id: research.id, value });
  };
  const closeDetails = () => setDetails(null);
  const openSource = (url: string) => {
    const safe = safeSourceUrl(url);
    if (safe) void openBrowserAsync(safe);
  };
  const reviewed = (run: IngestionRunSummary) => {
    if (run.status === 'PUBLISHED' && research?.status !== 'PUBLISHED')
      store.reload();
  };

  if (!store.signedIn)
    return (
      <Text
        className="text-muted-foreground py-4 text-sm"
        accessibilityLiveRegion="polite"
      >
        Sign in to view your research request.
      </Text>
    );
  if (!research) {
    if (store.loadFailed)
      return (
        <View className="py-4">
          <Text role="alert" className="text-sm">
            This research request could not be loaded. It may be unavailable to
            your account.
          </Text>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 min-h-11 self-start"
            accessibilityRole="button"
            accessibilityLabel="Try again"
            onPress={store.reload}
          >
            <Text>Try again</Text>
          </Button>
        </View>
      );
    return (
      <Text
        className="text-muted-foreground py-4 text-sm"
        accessibilityLiveRegion="polite"
      >
        Loading your research request…
      </Text>
    );
  }

  const reviewable = researchIsReviewable(research);
  const evidence = open?.kind === 'evidence' ? open : null;
  const evidenceSheet = (
    <DetailSheet
      visible={!!evidence}
      title="Research evidence"
      closeLabel="Close research details"
      onClose={closeDetails}
    >
      <Text className="text-muted-foreground mb-3 text-xs">
        Source, versions, original values and preserved observations. The data
        follows the progress without a new search.
      </Text>
      {evidence?.focus ? (
        <Button
          variant="outline"
          size="sm"
          className="mb-3 min-h-11 self-start"
          accessibilityRole="button"
          accessibilityLabel="See all evidence"
          onPress={() => openDetails({ kind: 'evidence', focus: null })}
        >
          <Text>See all evidence</Text>
        </Button>
      ) : null}
      <ResearchEvidencePane
        key={
          evidence?.focus
            ? `${evidence.focus.configuration}:${evidence.focus.attribute}`
            : 'all'
        }
        research={research}
        focus={evidence?.focus ?? null}
        busy={store.cancelPending}
        replaying={store.replayPending}
        updating={store.isFetching}
        error={store.cancellationError || store.reinterpretationError}
        onOpenSource={openSource}
        onCancel={store.detach}
        onRefresh={store.reload}
        onReplay={store.reinterpret}
      />
    </DetailSheet>
  );
  const reviewShown = reviewable && reviewOpen;

  return (
    <View className="w-full">
      <ResearchJournalPane
        key={research.id}
        research={research}
        updating={store.isFetching}
        error={
          store.loadFailed
            ? 'The progress could not be updated. The research continues; we will try again.'
            : ''
        }
        onEvidence={(focus) => openDetails({ kind: 'evidence', focus })}
        onPeople={() => openDetails({ kind: 'people' })}
        onRefresh={store.reload}
      />
      {reviewable ? (
        <View className="mt-4">
          <VehicleIngestionReviewDetail
            researchId={research.id}
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            onEvidence={(focus) => openDetails({ kind: 'evidence', focus })}
            onRunChanged={reviewed}
            overlay={reviewShown ? evidenceSheet : null}
          />
        </View>
      ) : null}
      {reviewShown ? null : evidenceSheet}
      <DetailSheet
        visible={open?.kind === 'people'}
        title="Interested people"
        closeLabel="Close research details"
        onClose={closeDetails}
      >
        {open?.kind === 'people' ? (
          <ResearchPeopleDetail research={research} />
        ) : null}
      </DetailSheet>
    </View>
  );
}
