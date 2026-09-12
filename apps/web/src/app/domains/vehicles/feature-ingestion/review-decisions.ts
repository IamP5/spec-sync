import type {
  IngestionConfigurationDraft,
  IngestionCurrentCell,
  IngestionReview,
} from '../data/ingestion-contracts';
import { claimGroups, type ClaimRow } from './ingestion-presentation';

/**
 * How one attribute of one configuration stands once the draft is compared
 * with the catalog and with what this run already published:
 *
 * - `auto`: one evidenced candidate that adds or changes catalog knowledge.
 *   It is pre-approved; the reviewer only has to leave it selected.
 * - `conflict`: several evidenced candidates. The reviewer picks one.
 * - `unverified`: no candidate whose value the cited lines support. Nothing
 *   here can be published; the reviewer acknowledges it.
 * - `same`: the catalog already holds this value; nothing to publish.
 * - `published`: a candidate this run already published; final for the run.
 */
export type DecisionKind =
  | 'auto'
  | 'conflict'
  | 'unverified'
  | 'same'
  | 'published';

export interface ReviewDecision {
  readonly attributeCode: string;
  readonly label: string;
  readonly kind: DecisionKind;
  /** Every proposed claim of the attribute, evidenced or not. */
  readonly rows: readonly ClaimRow[];
  /** The rows the API would accept: evidenced and one per attribute. */
  readonly candidates: readonly ClaimRow[];
  readonly published?: ClaimRow;
  /** Accepted catalog value the proposals are compared against. */
  readonly current: string;
}

/** Where a decision stands for the reviewer, given the kind and their choices. */
export type DecisionStatus =
  | 'published'
  | 'selected'
  | 'deferred'
  | 'pending'
  | 'same';

/** The reviewer's choices for one configuration; claim indexes address the draft. */
export interface ConfigurationDecisions {
  readonly identityConfirmed: boolean;
  /** Justification for this configuration alone; empty means the review reason applies. */
  readonly reason: string;
  /** Selected claim index per attribute code. */
  readonly selected: Record<string, number>;
  /** Attributes the reviewer set aside: conflicts left open, unverified evidence acknowledged. */
  readonly deferred: string[];
}

/** What the reviewer drafts for the whole run; the form model of the guided review. */
export interface ReviewModel {
  readonly reason: string;
  readonly configurations: ConfigurationDecisions[];
}

/** Claim indexes each publication of the run selected, per configuration index. */
export function publishedClaims(
  decisions: readonly IngestionReview[],
): ReadonlyMap<number, ReadonlySet<number>> {
  const published = new Map<number, Set<number>>();
  for (const review of decisions)
    for (const decision of review.configurations) {
      const claims = published.get(decision.configuration) ?? new Set();
      for (const index of decision.selectedClaims) claims.add(index);
      published.set(decision.configuration, claims);
    }
  return published;
}

export function reviewDecisions(
  configuration: IngestionConfigurationDraft,
  current: Record<string, IngestionCurrentCell> | undefined,
  published: ReadonlySet<number>,
  locale: string,
): ReviewDecision[] {
  return claimGroups(configuration, current, locale).map((group) => {
    const done = group.rows.find((row) => published.has(row.index));
    const candidates = group.rows.filter((row) => row.change !== 'invalid');
    const kind: DecisionKind = done
      ? 'published'
      : candidates.length === 0
        ? 'unverified'
        : candidates.length > 1
          ? 'conflict'
          : candidates[0].change === 'same'
            ? 'same'
            : 'auto';
    return {
      attributeCode: group.attributeCode,
      label: group.label,
      kind,
      rows: group.rows,
      candidates,
      ...(done ? { published: done } : {}),
      current: group.rows[0]?.current ?? '',
    };
  });
}

/** Fresh choices: every pre-approved attribute selected, nothing else decided. */
export function initialDecisions(
  decisions: readonly ReviewDecision[],
): ConfigurationDecisions {
  const selected: Record<string, number> = {};
  for (const decision of decisions)
    if (decision.kind === 'auto')
      selected[decision.attributeCode] = decision.candidates[0].index;
  return { identityConfirmed: false, reason: '', selected, deferred: [] };
}

/**
 * The choices that survive a new revision of the same draft (typically this
 * run's own publication): a selection stays while its claim is still an open
 * candidate, a deferral while the attribute is still open, and the identity
 * confirmation and reason stay with the configuration.
 */
export function carryOverDecisions(
  previous: ConfigurationDecisions | undefined,
  decisions: readonly ReviewDecision[],
): ConfigurationDecisions {
  if (!previous) return initialDecisions(decisions);
  const open = new Map(
    decisions
      .filter((decision) => decision.kind !== 'published')
      .map((decision) => [decision.attributeCode, decision]),
  );
  const selected: Record<string, number> = {};
  for (const [code, index] of Object.entries(previous.selected)) {
    const decision = open.get(code);
    if (decision?.candidates.some((row) => row.index === index))
      selected[code] = index;
  }
  return {
    ...previous,
    selected,
    deferred: previous.deferred.filter((code) => open.has(code)),
  };
}

export function chooseCandidate(
  state: ConfigurationDecisions,
  decision: ReviewDecision,
  index: number,
): ConfigurationDecisions {
  if (!decision.candidates.some((row) => row.index === index)) return state;
  return {
    ...state,
    selected: { ...state.selected, [decision.attributeCode]: index },
    deferred: state.deferred.filter((code) => code !== decision.attributeCode),
  };
}

export function clearChoice(
  state: ConfigurationDecisions,
  attributeCode: string,
): ConfigurationDecisions {
  const selected = { ...state.selected };
  delete selected[attributeCode];
  return { ...state, selected };
}

export function deferDecision(
  state: ConfigurationDecisions,
  attributeCode: string,
): ConfigurationDecisions {
  return {
    ...clearChoice(state, attributeCode),
    deferred: [...new Set([...state.deferred, attributeCode])],
  };
}

/** Selects every open pre-approved attribute again; conflicts stay with the reviewer. */
export function selectPreApproved(
  state: ConfigurationDecisions,
  decisions: readonly ReviewDecision[],
): ConfigurationDecisions {
  const selected = { ...state.selected };
  for (const decision of decisions)
    if (decision.kind === 'auto')
      selected[decision.attributeCode] = decision.candidates[0].index;
  return {
    ...state,
    selected,
    deferred: state.deferred.filter((code) => !(code in selected)),
  };
}

export function decisionStatus(
  decision: ReviewDecision,
  state: ConfigurationDecisions,
): DecisionStatus {
  if (decision.kind === 'published') return 'published';
  if (decision.attributeCode in state.selected) return 'selected';
  if (state.deferred.includes(decision.attributeCode)) return 'deferred';
  if (decision.kind === 'same') return 'same';
  return 'pending';
}

export interface DecisionCounts {
  readonly total: number;
  readonly pending: number;
  readonly selected: number;
  readonly published: number;
  readonly deferred: number;
}

export function decisionCounts(
  decisions: readonly ReviewDecision[],
  state: ConfigurationDecisions,
): DecisionCounts {
  const counts = {
    total: decisions.length,
    pending: 0,
    selected: 0,
    published: 0,
    deferred: 0,
  };
  for (const decision of decisions) {
    const status = decisionStatus(decision, state);
    if (status !== 'same') counts[status] += 1;
  }
  return counts;
}

export function sumCounts(counts: readonly DecisionCounts[]): DecisionCounts {
  return counts.reduce(
    (total, item) => ({
      total: total.total + item.total,
      pending: total.pending + item.pending,
      selected: total.selected + item.selected,
      published: total.published + item.published,
      deferred: total.deferred + item.deferred,
    }),
    { total: 0, pending: 0, selected: 0, published: 0, deferred: 0 },
  );
}

/**
 * The next attribute still waiting for a decision after `from`, wrapping
 * around the configuration; `undefined` once nothing in it is pending.
 */
export function nextPending(
  decisions: readonly ReviewDecision[],
  state: ConfigurationDecisions,
  from: string | undefined,
): ReviewDecision | undefined {
  const start = decisions.findIndex(
    (decision) => decision.attributeCode === from,
  );
  const ordered = [
    ...decisions.slice(start + 1),
    ...decisions.slice(0, start + 1),
  ];
  return ordered.find(
    (decision) => decisionStatus(decision, state) === 'pending',
  );
}

/**
 * The publication the reviewer drafted: only configurations with a selection
 * take part, each with its own identity confirmation and, when written, its
 * own reason. The API refuses the payload again on its own terms.
 */
export function reviewPayload(
  run: { draftHash: string; baseRevision: number },
  model: ReviewModel,
): IngestionReview {
  return {
    draftHash: run.draftHash,
    baseRevision: run.baseRevision,
    reason: model.reason.trim(),
    configurations: model.configurations
      .map((state, index) => ({
        configuration: index,
        identityConfirmed: state.identityConfirmed,
        selectedClaims: Object.values(state.selected).sort((a, b) => a - b),
        ...(state.reason.trim() ? { reason: state.reason.trim() } : {}),
      }))
      .filter((decision) => decision.selectedClaims.length > 0),
  };
}

/** Whether every participating configuration confirmed its identity and the review has a reason. */
export function canPublish(model: ReviewModel): boolean {
  const participating = model.configurations.filter(
    (state) => Object.keys(state.selected).length > 0,
  );
  return (
    participating.length > 0 &&
    participating.every((state) => state.identityConfirmed) &&
    model.reason.trim().length > 0
  );
}
