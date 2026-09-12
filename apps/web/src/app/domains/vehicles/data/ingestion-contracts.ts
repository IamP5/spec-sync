import { z } from 'zod';

/** Upper bound of configurations one run imports; mirrors the API and AI limits. */
export const MAX_INGESTION_CONFIGURATIONS = 8;

/** Scope of a run as the API stores it (`Ingestion.Request`). */
export const ingestionRequestSchema = z.object({
  sourceUrl: z.string(),
  brand: z.string(),
  model: z.string(),
  market: z.literal('BR'),
  modelYear: z.number(),
  /** Names to import; empty means every configuration the source presents. */
  configurations: z.array(z.string()),
});
export type IngestionRequest = z.infer<typeof ingestionRequestSchema>;

export const ingestionClaimSchema = z.object({
  attributeCode: z.string(),
  label: z.string(),
  originalTerm: z.string().nullable().optional(),
  unit: z.string().nullable(),
  rawValue: z.string(),
  rawUnit: z.string().nullable(),
  availability: z.string().nullable(),
  listValue: z.array(z.string()).nullable(),
  qualifiers: z.record(z.string()),
  lineStart: z.number(),
  lineEnd: z.number(),
  excerpt: z.string(),
  locator: z.string(),
  value: z.unknown(),
  issues: z.array(z.string()),
});
export type IngestionClaim = z.infer<typeof ingestionClaimSchema>;

/** Evidence retained when the source describes a concept outside this interpretation's vocabulary. */
export const ingestionUnmappedObservationSchema = z.object({
  originalTerm: z.string(),
  termOrigin: z
    .enum(['SOURCE_TEXT', 'VISUAL_LABEL', 'DERIVED_TEXT'])
    .optional(),
  rawValue: z.string(),
  sourceUnit: z.string().nullable(),
  qualifiers: z.record(z.string()),
  lineStart: z.number(),
  lineEnd: z.number(),
  excerpt: z.string(),
  locator: z.string(),
  proposal: z
    .object({
      kind: z.enum([
        'ADD_ATTRIBUTE',
        'ADD_ALIAS',
        'EXTEND_VOCABULARY',
        'REVIEW_SEMANTICS',
      ]),
      attributeCode: z.string().nullable(),
      proposedCode: z.string().nullable(),
      label: z.string().nullable(),
      definition: z.string(),
      valueType: z.enum(['NUMBER', 'TEXT', 'LIST', 'AVAILABILITY']),
      unit: z.string().nullable(),
      dimension: z.string().nullable(),
      alternatives: z.array(z.string()),
    })
    .nullable(),
});
export type IngestionUnmappedObservation = z.infer<
  typeof ingestionUnmappedObservationSchema
>;

export const ingestionConfigurationDraftSchema = z.object({
  name: z.string(),
  identityLineStart: z.number(),
  identityLineEnd: z.number(),
  identityExcerpt: z.string(),
  claims: z.array(ingestionClaimSchema),
  unmappedObservations: z.array(ingestionUnmappedObservationSchema).optional(),
  warnings: z.array(z.string()),
});
export type IngestionConfigurationDraft = z.infer<
  typeof ingestionConfigurationDraftSchema
>;

export const ingestionStatusSchema = z.enum([
  'QUEUED',
  'PROCESSING',
  'REVIEW',
  'PUBLISHED',
  'REJECTED',
  'FAILED',
]);
export type IngestionStatus = z.infer<typeof ingestionStatusSchema>;

/** Accepted catalog cell of one attribute, as the specification matrix reports it. */
export const ingestionCurrentCellSchema = z.object({
  knowledge_status: z.string(),
  value: z.unknown(),
  availability: z.string().nullable(),
  qualifiers: z.unknown(),
});
export type IngestionCurrentCell = z.infer<typeof ingestionCurrentCellSchema>;

/** Decision for one configuration of the reviewed draft, addressed by index. */
export const ingestionConfigurationReviewSchema = z.object({
  configuration: z.number(),
  selectedClaims: z.array(z.number()),
  identityConfirmed: z.boolean(),
  /** A justification for this configuration alone; the review reason applies otherwise. */
  reason: z.string().nullish(),
});
export type IngestionConfigurationReview = z.infer<
  typeof ingestionConfigurationReviewSchema
>;
export const ingestionReviewSchema = z.object({
  draftHash: z.string(),
  baseRevision: z.number(),
  configurations: z.array(ingestionConfigurationReviewSchema),
  reason: z.string(),
});
export type IngestionReview = z.infer<typeof ingestionReviewSchema>;

export const ingestionRunSchema = z.object({
  id: z.string().uuid(),
  request: ingestionRequestSchema,
  status: ingestionStatusSchema,
  attempts: z.number(),
  draft: z
    .object({
      source: z.object({
        url: z.string().url(),
        title: z.string(),
        mimeType: z.string(),
        text: z.string(),
        textSha256: z.string(),
        parserVersion: z.string(),
      }),
      configurations: z.array(ingestionConfigurationDraftSchema),
      warnings: z.array(z.string()),
    })
    .nullable(),
  draftHash: z.string().nullable(),
  baseRevision: z.number(),
  /** Catalog configuration id per configuration name, once known. */
  configurationIds: z.record(z.string()),
  error: z.string().nullable(),
  projectionStatus: z.string(),
  projectionError: z.string().nullable(),
  /** Current catalog values per configuration name, then per attribute code. */
  currentValues: z.record(z.record(ingestionCurrentCellSchema)),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  /**
   * Every publication made from this draft, oldest first. A review may publish
   * part of the evidence and come back for the rest; the claims these decisions
   * selected are final for the run.
   */
  decisions: z.array(ingestionReviewSchema).default([]),
});
export type IngestionRun = z.infer<typeof ingestionRunSchema>;

export const ingestionSummarySchema = z.object({
  id: z.string().uuid(),
  request: ingestionRequestSchema,
  status: ingestionStatusSchema,
  configurations: z.number(),
  claims: z.number(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IngestionSummary = z.infer<typeof ingestionSummarySchema>;

export function parseIngestion(value: unknown): IngestionRun {
  return z.object({ result: ingestionRunSchema }).parse(value).result;
}
export function parseIngestionList(value: unknown): IngestionSummary[] {
  return z.object({ result: z.array(ingestionSummarySchema) }).parse(value)
    .result;
}

/**
 * Result of the AI service's `previewVehicleSource` tool: the configurations
 * one official source presents. Part of the contract with `apps/ai`.
 */
export const sourcePreviewSchema = z.object({
  status: z.literal('OK'),
  source: z.object({
    url: z.string(),
    title: z.string(),
    mimeType: z.string(),
    pageCount: z.number(),
  }),
  configurations: z.array(
    z.object({
      name: z.string(),
      powertrain: z.string().nullable(),
      column: z.string().nullable(),
      locator: z.string(),
      excerpt: z.string(),
    }),
  ),
  legend: z.array(z.object({ symbol: z.string(), meaning: z.string() })),
  modelYearNote: z.string().nullable(),
  notes: z.array(z.string()),
  message: z.string(),
});
export type SourcePreview = z.infer<typeof sourcePreviewSchema>;

/** Result of the AI service's `prepareVehicleIngestion` tool. */
export const ingestionPlanSchema = z.object({
  status: z.literal('READY_TO_START'),
  request: ingestionRequestSchema,
  url: z.string(),
  message: z.string(),
});
export type IngestionPlan = z.infer<typeof ingestionPlanSchema>;

/**
 * Arguments of the browser-side `startVehicleIngestion` tool the chat agent
 * calls; the curator confirms them and supplies the key in the browser.
 */
export const ingestionStartArgsSchema = z.object({
  sourceUrl: z.string(),
  brand: z.string(),
  model: z.string(),
  // The model sometimes sends numbers as strings.
  modelYear: z.coerce.number(),
  configurations: z.array(z.string()).default([]),
});
export type IngestionStartArgs = z.infer<typeof ingestionStartArgsSchema>;

/** What the browser tells the agent after the curator started (or declined) a run. */
export const ingestionStartResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('STARTED'),
    runId: z.string(),
    runStatus: ingestionStatusSchema,
    message: z.string(),
  }),
  z.object({ status: z.literal('CANCELLED'), message: z.string() }),
]);
export type IngestionStartResult = z.infer<typeof ingestionStartResultSchema>;

/** Compact, credential-free description of a run for the chat's context. */
export interface IngestionRunSummary {
  id: string;
  status: IngestionStatus;
  brand: string;
  model: string;
  modelYear: number;
  configurations: string[];
  claims: number;
  claimsWithIssues: number;
  warnings: string[];
  error: string | null;
  projectionStatus: string;
}

/** Prefill of the launch form; every field is optional. */
export interface IngestionLaunchPrefill {
  sourceUrl?: string;
  brand?: string;
  model?: string;
  modelYear?: number;
  configurations?: string[];
}

/** Whether two prefills would fill the form identically. */
export function samePrefill(
  a: IngestionLaunchPrefill,
  b: IngestionLaunchPrefill,
): boolean {
  return (
    (a.sourceUrl ?? '') === (b.sourceUrl ?? '') &&
    (a.brand ?? '') === (b.brand ?? '') &&
    (a.model ?? '') === (b.model ?? '') &&
    (a.modelYear ?? 2026) === (b.modelYear ?? 2026) &&
    (a.configurations ?? []).join('\n') === (b.configurations ?? []).join('\n')
  );
}
