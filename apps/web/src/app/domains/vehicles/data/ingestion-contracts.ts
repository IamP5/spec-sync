import { z } from 'zod';
export const ingestionRequestSchema = z.object({
  sourceUrl: z.string(),
  brand: z.string(),
  model: z.string(),
  name: z.string(),
  market: z.literal('BR'),
  modelYear: z.number(),
  configurationId: z.string().nullable().optional(),
});
const claimSchema = z.object({
  attributeCode: z.string(),
  label: z.string(),
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
export const ingestionRunSchema = z.object({
  id: z.string().uuid(),
  request: ingestionRequestSchema,
  status: z.enum([
    'QUEUED',
    'PROCESSING',
    'REVIEW',
    'PUBLISHED',
    'REJECTED',
    'FAILED',
  ]),
  attempts: z.number(),
  draft: z
    .object({
      source: z.object({
        url: z.string().url(),
        title: z.string(),
        text: z.string(),
        textSha256: z.string(),
        parserVersion: z.string(),
      }),
      identityLineStart: z.number(),
      identityLineEnd: z.number(),
      identityExcerpt: z.string(),
      claims: z.array(claimSchema),
    })
    .nullable(),
  draftHash: z.string().nullable(),
  baseRevision: z.number(),
  configurationId: z.string().nullable(),
  error: z.string().nullable(),
  projectionStatus: z.string(),
  projectionError: z.string().nullable(),
  currentValues: z.record(
    z.object({
      knowledge_status: z.string(),
      value: z.unknown(),
      availability: z.string().nullable(),
      qualifiers: z.unknown(),
    }),
  ),
});
export type IngestionRequest = z.infer<typeof ingestionRequestSchema>;
export type IngestionRun = z.infer<typeof ingestionRunSchema>;
export interface IngestionReview {
  draftHash: string;
  baseRevision: number;
  selectedClaims: number[];
  identityConfirmed: boolean;
  reason: string;
}
export function parseIngestion(value: unknown): IngestionRun {
  return z.object({ result: ingestionRunSchema }).parse(value).result;
}
