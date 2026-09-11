import { z } from 'zod';

export const attributeSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  valueType: z.enum(['NUMBER', 'TEXT', 'LIST', 'AVAILABILITY']),
  unit: z.string().nullable(),
});
export const vehicleImageSchema = z.object({
  url: z
    .string()
    .regex(
      /^https:\/\/storage\.googleapis\.com\/[a-z0-9][a-z0-9._-]*-vehicle-images\/vehicles\/primary\/[a-f0-9]{64}\/[a-zA-Z0-9._-]+$/,
    ),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  altText: z.string().min(1),
  matchScope: z.enum(['EXACT_CONFIGURATION', 'ILLUSTRATIVE']),
  sourcePageUrl: z
    .string()
    .url()
    .regex(/^https:\/\//),
});

export const configurationSchema = z.object({
  id: z.string().uuid(),
  brand: z.string(),
  model: z.string(),
  name: z.string(),
  market: z.string(),
  modelYear: z.number(),
  identityStatus: z.string(),
  identityNote: z.string().nullable(),
  identityEvidenceId: z.string().uuid().nullable(),
  primaryImage: vehicleImageSchema.nullish(),
});
export const evidenceSchema = z.object({
  id: z.string().uuid(),
  sourceRevisionId: z.string().uuid(),
  title: z.string(),
  path: z.string(),
  sha256: z.string(),
  provenance: z.string(),
  capturedOn: z.string(),
  publishedOn: z.string().nullable(),
  upstreamUrls: z.array(z.string()),
  lineStart: z.number(),
  lineEnd: z.number(),
  locator: z.string(),
  excerpt: z.string(),
});
export const observationSchema = z.object({
  id: z.string().uuid(),
  value: z.union([z.number(), z.string(), z.array(z.string()), z.null()]),
  availability: z
    .enum(['STANDARD', 'OPTIONAL', 'ABSENT', 'NOT_APPLICABLE'])
    .nullable(),
  qualifiers: z.record(z.unknown()),
  rawValue: z.string().nullable(),
  reviewStatus: z.string(),
  evidence: z.array(evidenceSchema),
});
export const cellSchema = z.object({
  configurationId: z.string().uuid(),
  knowledgeStatus: z.enum(['KNOWN', 'NOT_REPORTED', 'CONFLICTING']),
  reason: z.string().nullable(),
  selectedObservationId: z.string().uuid().nullable(),
  observations: z.array(observationSchema),
});
export const comparisonSchema = z.object({
  configurations: z.array(configurationSchema),
  rows: z.array(
    z.object({ attribute: attributeSchema, cells: z.array(cellSchema) }),
  ),
});
export const catalogPageSchema = z.object({
  items: z.array(configurationSchema),
  limit: z.number().int(),
  offset: z.number().int(),
  hasMore: z.boolean(),
  status: z.enum(['OK', 'PARTIAL']).optional(),
  notices: z.array(z.string()).optional(),
  nextSearches: z
    .array(
      z.object({
        q: z.string().max(100),
        market: z
          .string()
          .regex(/^[A-Z]{2}$/)
          .optional(),
        modelYear: z.number().int().min(1900).max(2200).optional(),
        limit: z.number().int().min(1).max(20),
        offset: z.number().int().min(0).max(100000),
      }),
    )
    .max(5)
    .optional(),
});
export const knowledgeSchema = z.object({
  status: z.enum(['OK', 'EMPTY', 'UNAVAILABLE']),
  message: z.string(),
  projectionVersion: z.string().nullable(),
  items: z.array(z.record(z.unknown())),
});
export const failureSchema = z.object({
  status: z.literal('ERROR'),
  message: z.string(),
  retryable: z.boolean(),
});
export const selectionSchema = z.object({
  configurationIds: z.array(z.string().uuid()).min(2).max(5),
  attributes: z
    .array(z.string().regex(/^[a-z][a-z0-9_]{0,79}$/))
    .max(50)
    .optional(),
});
export const singleSelectionSchema = z.object({
  configurationId: z.string().uuid(),
  attributes: z.array(z.string()).max(50).optional(),
});
export const searchSchema = z.object({
  q: z.string().max(100).default(''),
  market: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  modelYear: z.number().int().min(1900).max(2200).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).max(100000).default(0),
});
export type Comparison = z.infer<typeof comparisonSchema>;
export type VehicleConfiguration = z.infer<typeof configurationSchema>;
export type CatalogPage = z.infer<typeof catalogPageSchema>;

export type VehicleImageMetadata = z.infer<typeof vehicleImageSchema>;
