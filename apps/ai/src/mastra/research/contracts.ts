import { z } from 'zod';

import {
  claimSchema,
  configurationDraftSchema,
  extractionInput,
  requestSchema,
  sourceSchema,
} from '../ingestion/extraction';
import { ontologyVersionFields } from '../ingestion/ontology';

export const researchCreateSchema = z.object({
  id: z.string().uuid(),
  request: requestSchema,
});

const publicClaimSchema = claimSchema.extend({
  label: z.string().nullish(),
  unit: z.string().nullish(),
  value: z.unknown(),
});

/** Private subscription plus shared evidence; deliberately excludes worker and reviewer identities. */
export const researchSnapshotSchema = z.object({
  id: z.string().uuid(),
  workId: z.string().uuid(),
  requestStatus: z.enum(['ACTIVE', 'CANCELLED']),
  disposition: z.enum(['CREATED', 'JOINED', 'REUSED']),
  request: requestSchema,
  status: z.enum([
    'QUEUED',
    'PROCESSING',
    'REVIEW',
    'PUBLISHED',
    'REJECTED',
    'FAILED',
  ]),
  attempts: z.number().int().nonnegative(),
  stage: z.string(),
  configurations: z.array(
    configurationDraftSchema.extend({ claims: z.array(publicClaimSchema) }),
  ),
  warnings: z.array(z.string()),
  error: z.string().nullable(),
  source: sourceSchema.omit({ originalBase64: true, text: true }).nullable(),
  configurationIds: z.record(z.string().uuid()),
  createdAt: z.string(),
  updatedAt: z.string(),
  ...ontologyVersionFields,
  normalizationRevision: ontologyVersionFields.normalizationRevision.nullable(),
  replayedFromWorkId: z.string().uuid().nullish(),
});
export type ResearchSnapshot = z.infer<typeof researchSnapshotSchema>;

/** History contains only subscription metadata; evidence is fetched on demand. */
export const researchListItemSchema = researchSnapshotSchema.pick({
  id: true,
  workId: true,
  requestStatus: true,
  disposition: true,
  request: true,
  status: true,
  attempts: true,
  stage: true,
  createdAt: true,
  updatedAt: true,
});

export const sharedExtractionInput = extractionInput.extend({
  workId: z.string().uuid(),
  attemptId: z.string().uuid(),
  policyVersion: z.string().min(1).max(100),
});
export type SharedExtractionInput = z.infer<typeof sharedExtractionInput>;

/** Model-facing progress; full evidence stays on the authenticated browser API. */
export const researchSummarySchema = researchSnapshotSchema
  .pick({
    id: true,
    workId: true,
    requestStatus: true,
    disposition: true,
    request: true,
    status: true,
    attempts: true,
    stage: true,
    error: true,
    configurationIds: true,
    createdAt: true,
    updatedAt: true,
    ontologyRevision: true,
    normalizationRevision: true,
    readerRevision: true,
    replayedFromWorkId: true,
  })
  .extend({
    configurations: z.array(
      z.object({
        name: z.string(),
        claimCount: z.number().int().nonnegative(),
        issueCount: z.number().int().nonnegative(),
        unmappedCount: z.number().int().nonnegative(),
      }),
    ),
    source: z.object({ url: z.string(), title: z.string() }).nullable(),
    warnings: z.array(z.string()).max(10),
    warningCount: z.number().int().nonnegative(),
  });
export type ResearchSummary = z.infer<typeof researchSummarySchema>;

export function summarizeResearch(snapshot: ResearchSnapshot): ResearchSummary {
  const warnings = [
    ...snapshot.warnings,
    ...snapshot.configurations.flatMap((configuration) =>
      configuration.warnings.map(
        (warning) => `${configuration.name}: ${warning}`,
      ),
    ),
  ];
  return researchSummarySchema.parse({
    ...snapshot,
    configurations: snapshot.configurations.map((configuration) => ({
      name: configuration.name,
      claimCount: configuration.claims.length,
      issueCount: configuration.claims.reduce(
        (total, claim) => total + claim.issues.length,
        0,
      ),
      unmappedCount: configuration.unmappedObservations?.length ?? 0,
    })),
    source: snapshot.source
      ? { url: snapshot.source.url, title: snapshot.source.title }
      : null,
    warnings: warnings.slice(0, 10),
    warningCount: warnings.length,
  });
}
