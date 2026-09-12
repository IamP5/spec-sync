import { formatMeasurement } from './claim-presentation';
import type { IngestionClaim } from './ingestion-contracts';
import { researchIsActive, type ResearchSnapshot } from './research-contracts';

export interface ResearchComparisonRow {
  code: string;
  label: string;
  cells: IngestionClaim[][];
}

/** Keep competing observations and conditions; never pick a draft as an accepted value. */
export function researchComparisonRows(
  research: ResearchSnapshot,
): ResearchComparisonRow[] {
  const rows = new Map<string, ResearchComparisonRow>();
  research.configurations.forEach((configuration, index) => {
    for (const claim of configuration.claims) {
      let row = rows.get(claim.attributeCode);
      if (!row) {
        row = {
          code: claim.attributeCode,
          label: claim.label,
          cells: research.configurations.map(() => []),
        };
        rows.set(claim.attributeCode, row);
      }
      row.cells[index].push(claim);
    }
  });
  return [...rows.values()];
}

/**
 * Value of a claim in the research journal: the printed list items, else the
 * normalized value in its canonical unit formatted for `locale`, else the
 * value as printed in the source.
 */
export function researchClaimValue(
  claim: IngestionClaim,
  locale: string,
): string {
  if (claim.listValue?.length) return claim.listValue.join(', ');
  if (
    !claim.issues.length &&
    Array.isArray(claim.value) &&
    claim.value.length &&
    claim.value.every((value) => typeof value === 'string' && value.trim())
  )
    return claim.value.join(', ');
  if (!claim.issues.length && typeof claim.value === 'number')
    return formatMeasurement(claim.value, claim.unit, locale);
  const unit = claim.rawUnit || claim.unit;
  return `${claim.rawValue}${unit ? ` ${unit}` : ''}`;
}

export function researchStatus(research: ResearchSnapshot): string {
  if (research.requestStatus === 'CANCELLED') return $localize`Not following`;
  if (researchIsActive(research)) {
    const retrying =
      research.attempts > 1 ||
      (research.status === 'QUEUED' && research.attempts > 0);
    const attempts = research.attempts;
    if (research.status === 'QUEUED')
      return retrying
        ? $localize`Retry queued after attempt ${attempts}:attempt:`
        : $localize`Queued`;
    const progress =
      research.stage === 'capture-source'
        ? $localize`Source captured`
        : research.stage === 'identify-configurations'
          ? $localize`Configurations identified`
          : /^extract-(?:[a-f0-9]{20}-)?configuration-\d+$/.test(research.stage)
            ? $localize`Extracting specifications`
            : $localize`Researching sources`;
    return retrying
      ? $localize`Retrying research · attempt ${attempts}:attempt: · ${progress}:progress:`
      : progress;
  }
  return {
    REVIEW: $localize`Ready for review`,
    PUBLISHED: $localize`Catalog update published`,
    FAILED: $localize`Research failed`,
    REJECTED: $localize`Research rejected`,
    QUEUED: $localize`Queued`,
    PROCESSING: $localize`Researching sources`,
  }[research.status];
}

/** Checkpoints describe completed work; terminal failure never implies completion. */
export function researchStage(research: ResearchSnapshot): {
  index: number;
  label: string;
  note: string;
} {
  const stage = research.stage;
  const index = ['REVIEW', 'PUBLISHED'].includes(research.status)
    ? 3
    : stage === 'identify-configurations' ||
        /^extract-(?:[a-f0-9]{20}-)?configuration-\d+$/.test(stage) ||
        research.configurations.length > 0
      ? 2
      : stage === 'capture-source' || research.source
        ? 1
        : 0;
  if (research.requestStatus === 'CANCELLED')
    return {
      index,
      label: $localize`You stopped following`,
      note: $localize`The shared research may continue for other people.`,
    };
  if (research.status === 'FAILED' || research.status === 'REJECTED')
    return {
      index,
      label: $localize`The research needs attention`,
      note: $localize`The results found so far remain available to consult.`,
    };
  if (research.status === 'PUBLISHED')
    return {
      index,
      label: $localize`Catalog update published`,
      note: $localize`The evidence may include information beyond the published selection.`,
    };
  if (research.status === 'REVIEW')
    return {
      index,
      label: $localize`Ready for review`,
      note: $localize`Check the evidence and the information that still needs confirmation.`,
    };
  if (research.status === 'QUEUED')
    return {
      index,
      label: research.attempts
        ? $localize`Waiting for another attempt`
        : $localize`Research queued`,
      note: research.attempts
        ? $localize`The research resumes automatically and reuses the steps already completed.`
        : $localize`You can carry on in the chat. Results appear as the research progresses.`,
    };
  return {
    index,
    label: [
      $localize`Searching for sources`,
      $localize`Reading the document`,
      $localize`Checking the versions`,
    ][index],
    note: $localize`Updates automatically. You can leave and come back through the research history.`,
  };
}

export interface ResearchEvidenceFocus {
  configuration: string;
  attribute: string;
}
