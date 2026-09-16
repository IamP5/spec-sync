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
  type ResearchSnapshot,
  researchSnapshotSchema,
} from '../../data/research-contracts';
export {
  type CatalogPage,
  catalogPageSchema,
  type CatalogSearch,
  catalogSearchSchema,
  type Comparison,
  comparisonSchema,
  failureSchema,
  knowledgeSchema,
  type VehicleConfiguration,
} from '../../data/vehicle-contracts';
export type {
  VehicleQuestion,
  VehicleReviewsContext,
} from '../../data/vehicle-interactions';
