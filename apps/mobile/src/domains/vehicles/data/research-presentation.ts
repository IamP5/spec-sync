import { formatMeasurement } from './claim-presentation';
import type {
  IngestionClaim,
  IngestionUnmappedObservation,
} from './ingestion-contracts';
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
      row.cells[index]?.push(claim);
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

/** Value of a claim in the evidence: the printed list, else the value as printed. */
export function researchEvidenceValue(claim: IngestionClaim): string {
  if (claim.listValue?.length) return claim.listValue.join(', ');
  if (
    !claim.issues.length &&
    Array.isArray(claim.value) &&
    claim.value.length &&
    claim.value.every((value) => typeof value === 'string' && value.trim())
  )
    return claim.value.join(', ');
  return claim.rawValue;
}

const EXTRACT_STAGE = /^extract-(?:[a-f0-9]{20}-)?configuration-\d+$/;

export function researchStatus(research: ResearchSnapshot): string {
  if (research.requestStatus === 'CANCELLED') return 'Not following';
  if (researchIsActive(research)) {
    const retrying =
      research.attempts > 1 ||
      (research.status === 'QUEUED' && research.attempts > 0);
    const attempts = research.attempts;
    if (research.status === 'QUEUED')
      return retrying ? `Retry queued after attempt ${attempts}` : 'Queued';
    const progress =
      research.stage === 'capture-source'
        ? 'Source captured'
        : research.stage === 'identify-configurations'
          ? 'Configurations identified'
          : EXTRACT_STAGE.test(research.stage)
            ? 'Extracting specifications'
            : 'Researching sources';
    return retrying
      ? `Retrying research · attempt ${attempts} · ${progress}`
      : progress;
  }
  return {
    REVIEW: 'Ready for review',
    PUBLISHED: 'Catalog update published',
    FAILED: 'Research failed',
    REJECTED: 'Research rejected',
    QUEUED: 'Queued',
    PROCESSING: 'Researching sources',
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
        EXTRACT_STAGE.test(stage) ||
        research.configurations.length > 0
      ? 2
      : stage === 'capture-source' || research.source
        ? 1
        : 0;
  if (research.requestStatus === 'CANCELLED')
    return {
      index,
      label: 'You stopped following',
      note: 'The shared research may continue for other people.',
    };
  if (research.status === 'FAILED' || research.status === 'REJECTED')
    return {
      index,
      label: 'The research needs attention',
      note: 'The results found so far remain available to consult.',
    };
  if (research.status === 'PUBLISHED')
    return {
      index,
      label: 'Catalog update published',
      note: 'The evidence may include information beyond the published selection.',
    };
  if (research.status === 'REVIEW')
    return {
      index,
      label: 'Ready for review',
      note: 'Check the evidence and the information that still needs confirmation.',
    };
  if (research.status === 'QUEUED')
    return {
      index,
      label: research.attempts
        ? 'Waiting for another attempt'
        : 'Research queued',
      note: research.attempts
        ? 'The research resumes automatically and reuses the steps already completed.'
        : 'You can carry on in the chat. Results appear as the research progresses.',
    };
  return {
    index,
    label:
      [
        'Searching for sources',
        'Reading the document',
        'Checking the versions',
      ][index] ?? 'Checking the versions',
    note: 'Updates automatically. You can leave and come back through the research history.',
  };
}

export function researchDispositionLabel(
  disposition: ResearchSnapshot['disposition'],
): string {
  if (disposition === 'JOINED') return 'You are following a shared research';
  if (disposition === 'REUSED') return 'Existing research reused';
  return 'Research started';
}

export function researchSharingLabel(
  disposition: ResearchSnapshot['disposition'],
): string {
  return {
    CREATED: 'Research started',
    JOINED: 'Joined shared research',
    REUSED: 'Existing research reused',
  }[disposition];
}

/** Whether a completed research on a saved source may be read again. */
export function researchCanReplay(research: ResearchSnapshot): boolean {
  return (
    research.requestStatus === 'ACTIVE' &&
    !!research.source &&
    (research.status === 'REVIEW' || research.status === 'PUBLISHED')
  );
}

/** Whether a research has a draft the reader can review and publish. */
export function researchIsReviewable(
  research: ResearchSnapshot | null | undefined,
): boolean {
  return (
    research?.requestStatus === 'ACTIVE' &&
    (research.status === 'REVIEW' || research.status === 'PUBLISHED')
  );
}

/** Whether a configuration name is part of what the research asked for. */
export function researchRequested(
  research: ResearchSnapshot,
  name: string,
): boolean {
  const requested = research.request.configurations;
  return (
    requested.length === 0 ||
    requested.some(
      (value) =>
        value.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
    )
  );
}

/** The version the journal opens on: the chosen one, else the first requested. */
export function researchSelectedIndex(
  research: ResearchSnapshot,
  selected: string,
): number {
  const configurations = research.configurations;
  const chosen = configurations.findIndex((item) => item.name === selected);
  if (chosen >= 0) return chosen;
  const requested = research.request.configurations;
  const match = configurations.findIndex((item) =>
    requested.some(
      (name) =>
        name.trim().toLocaleLowerCase() ===
        item.name.trim().toLocaleLowerCase(),
    ),
  );
  return Math.max(0, match);
}

export function proposalKindLabel(
  proposal: NonNullable<IngestionUnmappedObservation['proposal']>,
): string {
  return {
    ADD_ATTRIBUTE: 'New catalog field',
    ADD_ALIAS: 'Manufacturer terminology',
    EXTEND_VOCABULARY: 'New catalog value',
    REVIEW_SEMANTICS: 'Meaning needs review',
  }[proposal.kind];
}

export interface ResearchEvidenceFocus {
  configuration: string;
  attribute: string;
}

/** The evidence to show: everything, or one attribute of one version. */
export function researchEvidenceConfigurations(
  research: ResearchSnapshot,
  focus: ResearchEvidenceFocus | null,
): ResearchSnapshot['configurations'] {
  return focus
    ? research.configurations
        .filter((item) => item.name === focus.configuration)
        .map((item) => ({
          ...item,
          claims: item.claims.filter(
            (claim) => claim.attributeCode === focus.attribute,
          ),
        }))
    : research.configurations;
}

export function plural(count: number, one: string, other: string): string {
  return count === 1 ? one : other.replace('{n}', String(count));
}
