import type { IngestionRun } from '../domains/vehicles/data/ingestion-contracts';
import type {
  ResearchSnapshot,
  ResearchSummary,
} from '../domains/vehicles/data/research-contracts';

export const RESEARCH_ID = '0deba290-126f-40f2-8583-766f9b7626fd';
export const SECOND_RESEARCH_ID = '3c75f9a2-c2cf-4f5b-b897-ce7a31a055ce';

export function researchSnapshot(
  overrides: Partial<ResearchSnapshot> = {},
): ResearchSnapshot {
  return {
    id: RESEARCH_ID,
    workId: '5682493a-6908-4e26-897e-bb62477e1914',
    requestStatus: 'ACTIVE',
    disposition: 'JOINED',
    request: {
      sourceUrl: 'https://example.com/vehicle.pdf',
      brand: 'Ford',
      model: 'Ranger',
      market: 'BR',
      modelYear: 2026,
      configurations: ['Limited'],
    },
    status: 'PROCESSING',
    attempts: 1,
    stage: 'Extracting source specifications',
    configurations: [],
    warnings: [],
    error: null,
    source: null,
    configurationIds: {},
    createdAt: '2026-09-08T12:00:00Z',
    updatedAt: '2026-09-08T12:01:00Z',
    ...overrides,
  };
}

export function researchDraft(): ResearchSnapshot {
  return researchSnapshot({
    status: 'REVIEW',
    stage: 'Ready for review',
    ontologyRevision: 4,
    normalizationRevision: 'numeric-v3',
    source: {
      url: 'https://example.com/vehicle.pdf',
      title: 'Vehicle specification source',
      mimeType: 'application/pdf',
      originalSha256: 'a'.repeat(64),
      textSha256: 'b'.repeat(64),
      parserVersion: 'fixture-reader-v1',
    },
    warnings: ['Source coverage ends at the captured document.'],
    configurations: ['Limited', 'XLT'].map((name) => ({
      name,
      identityLineStart: 3,
      identityLineEnd: 3,
      identityExcerpt: `Columns: Limited | XLT`,
      warnings: [],
      claims: [
        {
          attributeCode: 'power',
          label: 'Power',
          originalTerm: 'Potência máxima',
          unit: 'cv',
          rawValue: '250',
          rawUnit: 'cv',
          availability: null,
          listValue: null,
          qualifiers: { fuel: 'diesel', rpm: '3.250' },
          lineStart: 5,
          lineEnd: 6,
          excerpt: '250 cv at 3.250 rpm',
          locator: 'Page 2, power table',
          value: 250,
          issues: ['Confirm model-year applicability.'],
        },
      ],
    })),
  });
}

export function researchWithUnmappedFindings(): ResearchSnapshot {
  const draft = researchDraft();
  return {
    ...draft,
    configurations: draft.configurations.map((configuration) => ({
      ...configuration,
      unmappedObservations: [
        {
          originalTerm: 'Capacidade de reboque',
          termOrigin: 'VISUAL_LABEL',
          rawValue: '3.492',
          sourceUnit: 'kg',
          qualifiers: { braking: 'Not specified by the source' },
          lineStart: 12,
          lineEnd: 12,
          excerpt: 'Capacidade de reboque (kg): 3.492',
          locator: 'Page 2, towing row, Limited column',
          proposal: {
            kind: 'ADD_ATTRIBUTE',
            attributeCode: null,
            proposedCode: 'towing_capacity',
            label: 'Towing capacity',
            definition: 'Maximum trailer mass under the stated conditions.',
            valueType: 'NUMBER',
            unit: 'kg',
            dimension: 'mass',
            alternatives: [
              'Braked towing capacity',
              'Unbraked towing capacity',
            ],
          },
        },
      ],
    })),
  };
}

export function researchSummary(): ResearchSummary {
  const full = researchDraft();
  return {
    id: full.id,
    workId: full.workId,
    requestStatus: full.requestStatus,
    disposition: full.disposition,
    request: full.request,
    status: full.status,
    attempts: full.attempts,
    stage: full.stage,
    createdAt: full.createdAt,
    updatedAt: full.updatedAt,
  };
}

/** The review run the API opens for `researchDraft()`: same draft, nothing published yet. */
export function reviewRun(overrides: Partial<IngestionRun> = {}): IngestionRun {
  const draft = researchDraft();
  return {
    id: draft.workId,
    request: draft.request,
    status: 'REVIEW',
    attempts: 1,
    draftHash: 'c'.repeat(64),
    baseRevision: 4,
    configurationIds: {},
    error: null,
    projectionStatus: 'NOT_REQUESTED',
    projectionError: null,
    currentValues: {},
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    decisions: [],
    draft: {
      source: {
        url: 'https://example.com/vehicle.pdf',
        title: 'Vehicle specification source',
        mimeType: 'application/pdf',
        text: 'Ranger 2026\nSpecifications\nColumns: Limited | XLT\n\n250 cv at 3.250 rpm\n',
        textSha256: 'b'.repeat(64),
        parserVersion: 'fixture-reader-v1',
      },
      configurations: draft.configurations,
      warnings: draft.warnings,
    },
    ...overrides,
  };
}
