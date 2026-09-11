export {
  type IngestionLaunchPrefill,
  type IngestionPlan,
  ingestionPlanSchema,
  type IngestionRun,
  type IngestionRunSummary,
  type IngestionStartArgs,
  ingestionStartArgsSchema,
  type IngestionStartResult,
  ingestionStartResultSchema,
  samePrefill,
  type SourcePreview,
  sourcePreviewSchema,
} from '../../data/ingestion-contracts';
export {
  capabilityResultSchema,
  conceptResultSchema,
  evidenceExcerptResultSchema,
  reviewEvidenceItemSchema,
  type ReviewEvidenceResult,
  reviewEvidenceResultSchema,
  specificationExcerptSchema,
} from '../../data/knowledge-contracts';
export {
  type ResearchSnapshot,
  researchSnapshotSchema,
  researchSummarySchema,
} from '../../data/research-contracts';
export {
  attributeSchema,
  type CatalogPage,
  catalogPageSchema,
  type Comparison,
  comparisonSchema,
  evidenceSchema,
  failureSchema,
  knowledgeSchema,
  type VehicleConfiguration,
} from '../../data/vehicle-contracts';
export type {
  VehicleQuestion,
  VehicleReviewsContext,
} from '../../data/vehicle-interactions';
