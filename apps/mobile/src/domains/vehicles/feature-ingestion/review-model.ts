import type {
  IngestionConfigurationDraft,
  IngestionRun,
} from '../data/ingestion-contracts';
import {
  carryOverDecisions,
  type ConfigurationDecisions,
  decisionStatus,
  initialDecisions,
  publishedClaims,
  type ReviewDecision,
  reviewDecisions,
  type ReviewModel,
} from './review-decisions';

/**
 * The guided review screen's derived state, kept pure so the smart screen
 * only holds the reviewer's choices (a port of the computed signals of the
 * web `VehicleIngestionReviewDetail`).
 */

export type DecisionFilter = 'all' | 'pending' | 'selected' | 'published';

export const DECISION_FILTERS: readonly {
  id: DecisionFilter;
  label: string;
}[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'selected', label: 'Selected' },
  { id: 'published', label: 'Published' },
];

export function runConfigurations(
  run: IngestionRun | undefined,
): IngestionConfigurationDraft[] {
  return run?.draft?.configurations ?? [];
}

/** Every configuration's decisions, compared with the catalog and this run's publications. */
export function runDecisions(
  run: IngestionRun | undefined,
  locale: string,
): ReviewDecision[][] {
  const published = publishedClaims(run?.decisions ?? []);
  return runConfigurations(run).map((configuration, index) =>
    reviewDecisions(
      configuration,
      run?.currentValues[configuration.name],
      published.get(index) ?? new Set(),
      locale,
    ),
  );
}

/** The draft revision the reviewer's choices belong to. */
export function modelRevision(run: IngestionRun | undefined): string {
  return `${run?.draftHash ?? ''}|${run?.baseRevision ?? 0}|${run?.decisions.length ?? 0}`;
}

export interface RevisionedModel {
  readonly revision: string;
  readonly model: ReviewModel;
}

/**
 * The choices for a revision: a new revision of the same draft keeps the
 * choices still valid; another draft starts over from the pre-approved ones.
 */
export function reconcileModel(
  previous: RevisionedModel | undefined,
  revision: string,
  decisions: readonly ReviewDecision[][],
): RevisionedModel {
  const hash = revision.split('|')[0];
  const keep = !!previous && !!hash && previous.revision.split('|')[0] === hash;
  return {
    revision,
    model: {
      reason: keep ? previous.model.reason : '',
      configurations: decisions.map((items, index) =>
        keep
          ? carryOverDecisions(previous.model.configurations[index], items)
          : initialDecisions(items),
      ),
    },
  };
}

export function stateAt(
  model: ReviewModel,
  decisions: readonly ReviewDecision[][],
  index: number,
): ConfigurationDecisions {
  return (
    model.configurations[index] ?? initialDecisions(decisions[index] ?? [])
  );
}

export function filterDecisions(
  decisions: readonly ReviewDecision[],
  state: ConfigurationDecisions,
  filter: DecisionFilter,
): ReviewDecision[] {
  return decisions.filter((decision) => {
    const status = decisionStatus(decision, state);
    return filter === 'all' || status === filter;
  });
}

/** Selected attributes the review pre-approved and the reviewer left in place. */
export function preApprovedCount(
  decisions: readonly ReviewDecision[][],
  model: ReviewModel,
): number {
  return decisions.reduce(
    (total, items, index) =>
      total +
      items.filter(
        (decision) =>
          decision.kind === 'auto' &&
          decision.attributeCode in
            (model.configurations[index]?.selected ?? {}),
      ).length,
    0,
  );
}

export interface PublicationBatch {
  readonly index: number;
  readonly name: string;
  readonly state: ConfigurationDecisions;
  readonly items: { label: string; proposed: string }[];
}

/** What the publication would contain, per participating configuration. */
export function publicationBatches(
  configurations: readonly IngestionConfigurationDraft[],
  decisions: readonly ReviewDecision[][],
  model: ReviewModel,
): PublicationBatch[] {
  return configurations
    .map((configuration, index) => {
      const state = stateAt(model, decisions, index);
      return {
        index,
        name: configuration.name,
        state,
        items: (decisions[index] ?? []).flatMap((decision) => {
          const chosen = decision.candidates.find(
            (row) => row.index === state.selected[decision.attributeCode],
          );
          return chosen
            ? [
                {
                  label: decision.label,
                  proposed: chosen.proposed || chosen.raw,
                },
              ]
            : [];
        }),
      };
    })
    .filter((batch) => batch.items.length > 0);
}

export function updateConfiguration(
  model: ReviewModel,
  index: number,
  update: (state: ConfigurationDecisions) => ConfigurationDecisions,
): ReviewModel {
  return {
    ...model,
    configurations: model.configurations.map((state, i) =>
      i === index ? update(state) : state,
    ),
  };
}
