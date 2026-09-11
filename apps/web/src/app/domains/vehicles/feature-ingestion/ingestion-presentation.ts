import type {
  IngestionClaim,
  IngestionConfigurationDraft,
  IngestionCurrentCell,
  IngestionRun,
  IngestionRunSummary,
  IngestionStatus,
} from '../data/ingestion-contracts';
import { displayValue } from '../util/vehicle-display';

/** Where a run stands, for the progress steps and badges. */
export interface RunStage {
  readonly label: string;
  readonly badge: 'default' | 'secondary' | 'destructive' | 'outline';
  /** Index of the reached step in {@link RUN_STEPS}; -1 when the run ended without review. */
  readonly step: number;
  readonly terminal: boolean;
}
export function runSteps(): string[] {
  return [
    $localize`Queued`,
    $localize`Extracting`,
    $localize`Review`,
    $localize`Published`,
  ];
}

export function runStage(status: IngestionStatus): RunStage {
  switch (status) {
    case 'QUEUED':
      return {
        label: $localize`Queued`,
        badge: 'secondary',
        step: 0,
        terminal: false,
      };
    case 'PROCESSING':
      return {
        label: $localize`Extracting`,
        badge: 'secondary',
        step: 1,
        terminal: false,
      };
    case 'REVIEW':
      return {
        label: $localize`Ready for review`,
        badge: 'default',
        step: 2,
        terminal: false,
      };
    case 'PUBLISHED':
      return {
        label: $localize`Published`,
        badge: 'outline',
        step: 3,
        terminal: true,
      };
    case 'REJECTED':
      return {
        label: $localize`Rejected`,
        badge: 'outline',
        step: -1,
        terminal: true,
      };
    case 'FAILED':
      return {
        label: $localize`Failed`,
        badge: 'destructive',
        step: -1,
        terminal: true,
      };
  }
}

/** Whether the browser should keep polling the run. */
export function runIsActive(run: IngestionRun | undefined): boolean {
  return (
    !!run &&
    (run.status === 'QUEUED' ||
      run.status === 'PROCESSING' ||
      run.projectionStatus === 'PENDING')
  );
}

export type ClaimChange = 'new' | 'same' | 'changed' | 'invalid';

export interface ClaimRow {
  readonly index: number;
  readonly claim: IngestionClaim;
  readonly proposed: string;
  readonly raw: string;
  readonly current: string;
  readonly change: ClaimChange;
  readonly qualifiers: string;
}

export interface ClaimGroup {
  readonly attributeCode: string;
  readonly label: string;
  readonly rows: ClaimRow[];
  /** More than one valid candidate for the same attribute: the reviewer picks one. */
  readonly conflicting: boolean;
}

/** Proposed value in the canonical unit, or the availability for equipment. */
export function proposedValue(claim: IngestionClaim): string {
  if (claim.availability) return availabilityLabel(claim.availability);
  if (claim.value === null || claim.value === undefined) return '';
  return `${displayValue(claim.value)}${claim.unit ? ` ${claim.unit}` : ''}`;
}

export function rawValue(claim: IngestionClaim): string {
  const items = claim.listValue?.length
    ? ` (${claim.listValue.join(', ')})`
    : '';
  return `${claim.rawValue}${claim.rawUnit ? ` ${claim.rawUnit}` : ''}${items}`;
}

export function availabilityLabel(value: string): string {
  return (
    (
      {
        STANDARD: $localize`Standard`,
        OPTIONAL: $localize`Optional`,
        ABSENT: $localize`Absent`,
        NOT_APPLICABLE: $localize`Not applicable`,
      } as Record<string, string>
    )[value] ?? value
  );
}

/** Accepted catalog value of the attribute, as the reviewer compares against it. */
export function currentValue(
  cell: IngestionCurrentCell | undefined,
  unit: string | null,
): string {
  if (!cell) return 'Not in catalog';
  if (cell.knowledge_status === 'CONFLICTING') return 'Conflicting';
  if (cell.knowledge_status !== 'KNOWN') return 'Not reported';
  if (cell.availability) return availabilityLabel(cell.availability);
  return `${displayValue(cell.value)}${unit ? ` ${unit}` : ''}`;
}

export function claimChange(
  claim: IngestionClaim,
  cell: IngestionCurrentCell | undefined,
): ClaimChange {
  if (claim.issues.length) return 'invalid';
  if (!cell || cell.knowledge_status !== 'KNOWN') return 'new';
  const same = claim.availability
    ? cell.availability === claim.availability
    : JSON.stringify(cell.value) === JSON.stringify(claim.value);
  return same ? 'same' : 'changed';
}

export function formatQualifiers(qualifiers: Record<string, string>): string {
  return Object.entries(qualifiers)
    .map(([name, value]) => `${name}: ${value}`)
    .join(' · ');
}

/** Claims of one configuration grouped per attribute, in draft order. */
export function claimGroups(
  configuration: IngestionConfigurationDraft,
  current: Record<string, IngestionCurrentCell> | undefined,
): ClaimGroup[] {
  const groups = new Map<string, ClaimRow[]>();
  const labels = new Map<string, string>();
  configuration.claims.forEach((claim, index) => {
    const cell = current?.[claim.attributeCode];
    const row: ClaimRow = {
      index,
      claim,
      proposed: proposedValue(claim),
      raw: rawValue(claim),
      current: currentValue(cell, claim.unit),
      change: claimChange(claim, cell),
      qualifiers: formatQualifiers(claim.qualifiers),
    };
    groups.set(claim.attributeCode, [
      ...(groups.get(claim.attributeCode) ?? []),
      row,
    ]);
    labels.set(claim.attributeCode, claim.label);
  });
  return [...groups.entries()].map(([attributeCode, rows]) => ({
    attributeCode,
    label: labels.get(attributeCode) ?? attributeCode,
    rows,
    conflicting: rows.filter((row) => row.change !== 'invalid').length > 1,
  }));
}

export type ClaimFilter = 'all' | 'changes' | 'issues' | 'conflicts';
export function claimFilters(): ReadonlyArray<{
  id: ClaimFilter;
  label: string;
}> {
  return [
    { id: 'all', label: $localize`All` },
    { id: 'changes', label: $localize`New or changed` },
    { id: 'conflicts', label: $localize`Conflicts` },
    { id: 'issues', label: $localize`Needs correction` },
  ];
}

export function filterGroups(
  groups: ClaimGroup[],
  filter: ClaimFilter,
): ClaimGroup[] {
  switch (filter) {
    case 'all':
      return groups;
    case 'conflicts':
      return groups.filter((group) => group.conflicting);
    case 'changes':
      return groups
        .map((group) => ({
          ...group,
          rows: group.rows.filter(
            (row) => row.change === 'new' || row.change === 'changed',
          ),
        }))
        .filter((group) => group.rows.length);
    case 'issues':
      return groups
        .map((group) => ({
          ...group,
          rows: group.rows.filter((row) => row.change === 'invalid'),
        }))
        .filter((group) => group.rows.length);
  }
}

/** Counts shown in the configuration tab and the run summary. */
export interface ClaimCounts {
  readonly total: number;
  readonly valid: number;
  readonly issues: number;
  readonly conflicts: number;
  readonly changes: number;
}
export function claimCounts(groups: ClaimGroup[]): ClaimCounts {
  const rows = groups.flatMap((group) => group.rows);
  return {
    total: rows.length,
    valid: rows.filter((row) => row.change !== 'invalid').length,
    issues: rows.filter((row) => row.change === 'invalid').length,
    conflicts: groups.filter((group) => group.conflicting).length,
    changes: rows.filter(
      (row) => row.change === 'new' || row.change === 'changed',
    ).length,
  };
}

/**
 * Selection that publishes every non-conflicting valid claim that adds or
 * changes catalog knowledge; conflicting attributes stay for the reviewer.
 */
export function defaultSelection(
  groups: ClaimGroup[],
  size: number,
): boolean[] {
  const selected = new Array<boolean>(size).fill(false);
  for (const group of groups)
    if (!group.conflicting)
      for (const row of group.rows)
        if (row.change === 'new' || row.change === 'changed')
          selected[row.index] = true;
  return selected;
}

/**
 * Toggles one claim while keeping at most one selected claim per attribute:
 * selecting a candidate of a conflicting attribute deselects its siblings.
 */
export function toggleSelection(
  selected: boolean[],
  groups: ClaimGroup[],
  index: number,
): boolean[] {
  const next = selected.slice();
  const willSelect = !next[index];
  if (willSelect) {
    const group = groups.find((item) =>
      item.rows.some((row) => row.index === index),
    );
    for (const row of group?.rows ?? []) next[row.index] = false;
  }
  next[index] = willSelect;
  return next;
}

/** Credential-free description of a run for the chat's context and cards. */
export function summarizeRun(run: IngestionRun): IngestionRunSummary {
  const claims = run.draft?.configurations.flatMap((c) => c.claims) ?? [];
  return {
    id: run.id,
    status: run.status,
    brand: run.request.brand,
    model: run.request.model,
    modelYear: run.request.modelYear,
    configurations:
      run.draft?.configurations.map((c) => c.name) ??
      run.request.configurations,
    claims: claims.length,
    claimsWithIssues: claims.filter((claim) => claim.issues.length).length,
    warnings: [
      ...(run.draft?.warnings ?? []),
      ...(run.draft?.configurations.flatMap((c) =>
        c.warnings.map((warning) => `${c.name}: ${warning}`),
      ) ?? []),
    ].slice(0, 20),
    error: run.error,
    projectionStatus: run.projectionStatus,
  };
}

/** Title of a run in lists and cards. */
export function runTitle(request: IngestionRun['request']): string {
  return `${request.brand} ${request.model} ${request.modelYear}`;
}

export function scopeLabel(configurations: string[]): string {
  return configurations.length
    ? configurations.join(', ')
    : 'Every configuration the source presents';
}
