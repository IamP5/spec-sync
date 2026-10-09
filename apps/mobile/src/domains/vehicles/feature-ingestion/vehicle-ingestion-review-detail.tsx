import { ArrowLeft, ArrowRight, Send } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { View } from 'react-native';

import { Badge } from '../../../design-system/components/ui/badge';
import { Button } from '../../../design-system/components/ui/button';
import { Icon } from '../../../design-system/components/ui/icon';
import { Skeleton } from '../../../design-system/components/ui/skeleton';
import { Text } from '../../../design-system/components/ui/text';
import { DISPLAY_LOCALE } from '../data/claim-presentation';
import type { IngestionRunSummary } from '../data/ingestion-contracts';
import type { ResearchEvidenceFocus } from '../data/research-presentation';
import { CheckRow } from '../ui/check-row';
import { DetailSheet } from '../ui/detail-sheet';
import { FilterChip } from '../ui/filter-chip';
import { summarizeRun } from './ingestion-presentation';
import { useResearchReviewDetailStore } from './research-review-detail-store';
import {
  canPublish,
  chooseCandidate,
  clearChoice,
  decisionCounts,
  decisionStatus,
  deferDecision,
  nextPending,
  type ReviewDecision,
  reviewPayload,
  selectPreApproved,
  sumCounts,
} from './review-decisions';
import {
  DECISION_FILTERS,
  type DecisionFilter,
  filterDecisions,
  modelRevision,
  preApprovedCount,
  publicationBatches,
  reconcileModel,
  type RevisionedModel,
  runConfigurations,
  runDecisions,
  stateAt,
  updateConfiguration,
} from './review-model';
import { IngestionDecisionPane } from './ui/ingestion-decision-pane';
import { ReviewDecisionList } from './ui/review-decision-list';
import { ReviewPublicationPane } from './ui/review-publication-pane';
import { ReviewSummaryPane } from './ui/review-summary-pane';

type ReviewView = 'queue' | 'decision' | 'publication';

/**
 * Guided review of one research draft (web `VehicleIngestionReviewDetail`),
 * one decision at a time. Evidenced candidates without competition are
 * pre-approved, so the reviewer only decides conflicts and acknowledges
 * unverified evidence before publishing. A publication may cover part of the
 * draft; what it published stays visible and the rest remains available.
 *
 * The chat card shows the summary strip; the decisions open full screen.
 * Choices live with this component for the draft revision they were made
 * on: a new revision keeps the ones still valid and drops the rest.
 */
export function VehicleIngestionReviewDetail({
  researchId,
  open,
  onOpenChange,
  onEvidence,
  onRunChanged,
  overlay,
}: {
  researchId: string;
  /** Whether the decisions are shown; the summary strip is always there. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEvidence: (focus: ResearchEvidenceFocus) => void;
  /** Credential-free summary of the run a publication persisted. */
  onRunChanged?: (run: IngestionRunSummary) => void;
  /** Rendered inside the full-screen review, e.g. the evidence sheet. */
  overlay?: ReactNode;
}) {
  const store = useResearchReviewDetailStore(researchId);
  const run = store.run;
  const configurations = runConfigurations(run);
  const decisions = runDecisions(run, DISPLAY_LOCALE);
  const reviewable = run?.status === 'REVIEW' || run?.status === 'PUBLISHED';

  // The reviewer's choices, re-derived when the draft revision changes.
  const revision = modelRevision(run);
  const [draft, setDraft] = useState<RevisionedModel | undefined>(undefined);
  let current = draft;
  if (run && current?.revision !== revision) {
    current = reconcileModel(current, revision, decisions);
    setDraft(current);
  }
  const model = current?.model ?? { reason: '', configurations: [] };

  const [activeIndex, setActiveIndex] = useState(0);
  const [filter, setFilter] = useState<DecisionFilter>('all');
  const [focusedCodes, setFocusedCodes] = useState<Record<number, string>>({});
  const [view, setView] = useState<ReviewView>('queue');
  const [receipt, setReceipt] = useState<{
    claims: number;
    configurations: number;
  } | null>(null);

  const configuration = configurations[activeIndex];
  const activeDecisions = decisions[activeIndex] ?? [];
  const activeState = stateAt(model, decisions, activeIndex);
  const counts = decisions.map((items, index) =>
    decisionCounts(items, stateAt(model, decisions, index)),
  );
  const totals = sumCounts(counts);
  const visible = filterDecisions(activeDecisions, activeState, filter);
  const focused =
    visible.find(
      (decision) => decision.attributeCode === focusedCodes[activeIndex],
    ) ?? visible[0];
  const position =
    visible.findIndex(
      (decision) => decision.attributeCode === focused?.attributeCode,
    ) + 1;
  const batches = publicationBatches(configurations, decisions, model);
  const busy = store.publishPending;
  const publishable = reviewable && canPublish(model) && !busy;
  const sheetVisible = open && reviewable;
  const error =
    store.publishError ||
    (store.loadFailed
      ? 'The review could not be loaded. Sign in and refresh.'
      : '');

  const setModel = (update: (value: typeof model) => typeof model) =>
    setDraft((previous) =>
      previous
        ? { revision: previous.revision, model: update(previous.model) }
        : previous,
    );
  const updateActive = (update: Parameters<typeof updateConfiguration>[2]) =>
    setModel((value) => updateConfiguration(value, activeIndex, update));
  const statusOf = (decision: ReviewDecision) =>
    decisionStatus(decision, activeState);
  const focus = (attributeCode: string, index = activeIndex) =>
    setFocusedCodes((codes) => ({ ...codes, [index]: attributeCode }));
  const selectConfiguration = (index: number) => {
    setActiveIndex(index);
    setFilter('all');
  };
  const navigate = (delta: number) => {
    if (!visible.length) return;
    const next =
      visible[(position - 1 + delta + visible.length) % visible.length];
    if (next) focus(next.attributeCode);
  };
  /** The next open decision here, then in the next configuration; the summary once none is left. */
  const goToNextPending = () => {
    const total = configurations.length;
    for (let step = 0; step < total; step += 1) {
      const index = (activeIndex + step) % total;
      const from = step === 0 ? focused?.attributeCode : undefined;
      const next = nextPending(
        decisions[index] ?? [],
        stateAt(model, decisions, index),
        from,
      );
      if (next) {
        if (index !== activeIndex) setActiveIndex(index);
        setFilter('all');
        focus(next.attributeCode, index);
        setView('decision');
        return;
      }
    }
    setView('publication');
  };
  const continueReviewing = () => {
    setReceipt(null);
    goToNextPending();
  };
  const publish = async () => {
    if (!run?.draftHash || !publishable) return;
    const review = reviewPayload(
      { draftHash: run.draftHash, baseRevision: run.baseRevision },
      model,
    );
    const persisted = await store.publish(review);
    if (!persisted) return;
    setReceipt({
      claims: review.configurations.reduce(
        (total, decision) => total + decision.selectedClaims.length,
        0,
      ),
      configurations: review.configurations.length,
    });
    setView('queue');
    onRunChanged?.(summarizeRun(persisted));
  };

  if (!run) {
    if (store.isLoading)
      return (
        <View
          className="gap-3"
          accessibilityLabel="Loading the review"
          accessibilityState={{ busy: true }}
        >
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </View>
      );
    return error ? (
      <View className="border-destructive rounded-lg border p-3">
        <Text role="alert" className="text-destructive text-sm">
          {error}
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
    ) : null;
  }

  const footer =
    view === 'publication' ? (
      <View className="flex-row flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          className="min-h-11"
          accessibilityRole="button"
          accessibilityLabel="Back to the decisions"
          onPress={() => setView('queue')}
        >
          <Icon as={ArrowLeft} className="size-4" />
          <Text>Back to the decisions</Text>
        </Button>
        <Button
          className="min-h-11 flex-1"
          accessibilityRole="button"
          accessibilityLabel={`Publish ${totals.selected} specifications`}
          disabled={!publishable}
          onPress={() => void publish()}
        >
          <Icon as={Send} className="size-4" />
          <Text>{busy ? 'Publishing…' : 'Publish'}</Text>
          <Badge variant="secondary">
            <Text>{totals.selected}</Text>
          </Badge>
        </Button>
      </View>
    ) : view === 'decision' && focused ? (
      <View className="flex-row flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11"
          accessibilityRole="button"
          accessibilityLabel="Previous decision"
          onPress={() => navigate(-1)}
        >
          <Icon as={ArrowLeft} className="size-4" />
          <Text>Previous</Text>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11"
          accessibilityRole="button"
          accessibilityLabel="Next decision"
          onPress={() => navigate(1)}
        >
          <Text>Next</Text>
          <Icon as={ArrowRight} className="size-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="min-h-11 flex-1"
          accessibilityRole="button"
          accessibilityLabel={
            totals.pending
              ? 'Next pending decision'
              : 'Nothing pending · review the publication'
          }
          onPress={goToNextPending}
        >
          <Text numberOfLines={1}>
            {totals.pending
              ? 'Next pending decision'
              : 'Nothing pending · review the publication'}
          </Text>
        </Button>
      </View>
    ) : (
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-muted-foreground flex-1 text-sm">
          {totals.selected} selected in {batches.length} configuration(s)
        </Text>
        <Button
          className="min-h-11"
          accessibilityRole="button"
          accessibilityLabel="Review the publication"
          disabled={!totals.selected || !reviewable}
          onPress={() => setView('publication')}
        >
          <Text>Review the publication</Text>
          <Icon as={ArrowRight} className="size-4" />
        </Button>
      </View>
    );

  return (
    <>
      <ReviewSummaryPane
        totals={totals}
        preApproved={preApprovedCount(decisions, model)}
        reviewable={reviewable}
        onOpen={() => onOpenChange(true)}
      />
      <DetailSheet
        visible={sheetVisible}
        fullScreen
        title="Review and publication"
        closeLabel="Back to the research"
        onClose={() => onOpenChange(false)}
        footer={footer}
        overlay={overlay}
      >
        {error ? (
          <Text
            role="alert"
            className="border-destructive text-destructive mb-3 rounded-lg border p-3 text-sm"
          >
            {error}
          </Text>
        ) : null}
        {receipt ? (
          <View
            className="border-border mb-3 rounded-lg border p-3"
            accessibilityLiveRegion="polite"
          >
            <Text className="text-sm">
              {receipt.claims} specification(s) published for{' '}
              {receipt.configurations} configuration(s). Pending decisions stay
              available here; the graph tools see the new values once the update
              is current.
            </Text>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 min-h-11 self-start"
              accessibilityRole="button"
              accessibilityLabel="Continue with the pending decisions"
              onPress={continueReviewing}
            >
              <Text>Continue with the pending decisions</Text>
            </Button>
          </View>
        ) : null}
        {configurations.length > 1 && view !== 'publication' ? (
          <View
            className="mb-2 flex-row flex-wrap gap-x-2"
            accessibilityLabel="Configuration under review"
          >
            {configurations.map((item, index) => (
              <FilterChip
                key={item.name}
                label={item.name}
                count={counts[index]?.pending ?? 0}
                selected={activeIndex === index}
                accessibilityLabel={`${item.name}, ${counts[index]?.pending ?? 0} pending`}
                onPress={() => selectConfiguration(index)}
              />
            ))}
          </View>
        ) : null}
        {view === 'publication' ? (
          <ReviewPublicationPane
            batches={batches}
            reason={model.reason}
            onReasonChange={(reason) =>
              setModel((value) => ({ ...value, reason }))
            }
            onIdentityChange={(index, identityConfirmed) =>
              setModel((value) =>
                updateConfiguration(value, index, (state) => ({
                  ...state,
                  identityConfirmed,
                })),
              )
            }
            onConfigurationReasonChange={(index, reason) =>
              setModel((value) =>
                updateConfiguration(value, index, (state) => ({
                  ...state,
                  reason,
                })),
              )
            }
          />
        ) : view === 'decision' && focused ? (
          <View className="gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 self-start"
              accessibilityRole="button"
              accessibilityLabel="All decisions"
              onPress={() => setView('queue')}
            >
              <Icon as={ArrowLeft} className="size-4" />
              <Text>All decisions</Text>
            </Button>
            <Text
              className="text-muted-foreground text-xs"
              accessibilityLiveRegion="polite"
            >
              Decision {position} of {visible.length} · {configuration?.name}
            </Text>
            <IngestionDecisionPane
              key={`${activeIndex}:${focused.attributeCode}`}
              decision={focused}
              configuration={configuration?.name ?? ''}
              status={statusOf(focused)}
              selectedIndex={activeState.selected[focused.attributeCode]}
              reviewing={reviewable}
              onChoose={(index) =>
                updateActive((state) => chooseCandidate(state, focused, index))
              }
              onClear={() =>
                updateActive((state) =>
                  clearChoice(state, focused.attributeCode),
                )
              }
              onDefer={() =>
                updateActive((state) =>
                  deferDecision(state, focused.attributeCode),
                )
              }
              onEvidence={() =>
                onEvidence({
                  configuration: configuration?.name ?? '',
                  attribute: focused.attributeCode,
                })
              }
            />
          </View>
        ) : (
          <View className="gap-3">
            {configuration ? (
              <CheckRow
                checked={activeState.identityConfirmed}
                accessibilityLabel={`This source applies to ${configuration.name}, exactly this model year`}
                onChange={(identityConfirmed) =>
                  updateActive((state) => ({ ...state, identityConfirmed }))
                }
              >
                <Text className="text-sm">
                  This source applies to{' '}
                  <Text className="text-sm font-semibold">
                    {configuration.name}
                  </Text>
                  , exactly this model year. Identity evidence on lines{' '}
                  {configuration.identityLineStart}–
                  {configuration.identityLineEnd}.
                </Text>
              </CheckRow>
            ) : null}
            <View
              className="flex-row flex-wrap gap-x-2"
              accessibilityLabel="Decision filters"
            >
              {DECISION_FILTERS.map((item) => {
                const count = counts[activeIndex];
                return (
                  <FilterChip
                    key={item.id}
                    label={item.label}
                    count={
                      count
                        ? item.id === 'all'
                          ? count.total
                          : count[item.id]
                        : 0
                    }
                    selected={filter === item.id}
                    onPress={() => setFilter(item.id)}
                  />
                );
              })}
            </View>
            {reviewable ? (
              <View className="flex-row flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  accessibilityRole="button"
                  accessibilityLabel="Select the pre-approved"
                  onPress={() =>
                    updateActive((state) =>
                      selectPreApproved(state, activeDecisions),
                    )
                  }
                >
                  <Text>Select the pre-approved</Text>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  accessibilityRole="button"
                  accessibilityLabel="Clear"
                  onPress={() =>
                    updateActive((state) => ({ ...state, selected: {} }))
                  }
                >
                  <Text>Clear</Text>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-11"
                  accessibilityRole="button"
                  accessibilityLabel={
                    totals.pending
                      ? 'Next pending decision'
                      : 'Nothing pending · review the publication'
                  }
                  onPress={goToNextPending}
                >
                  <Text>
                    {totals.pending
                      ? 'Next pending decision'
                      : 'Nothing pending · review the publication'}
                  </Text>
                </Button>
              </View>
            ) : null}
            <ReviewDecisionList
              decisions={visible}
              statusOf={statusOf}
              onOpen={(code) => {
                focus(code);
                setView('decision');
              }}
            />
          </View>
        )}
      </DetailSheet>
    </>
  );
}
