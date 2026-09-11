import { z } from 'zod';

import { attributeSchema } from './vehicle-contracts';

const envelope = z.object({
  status: z.enum(['OK', 'EMPTY', 'UNAVAILABLE']),
  message: z.string(),
  projectionVersion: z.string().nullable(),
});
const text = z.string().nullish();

/** Exact review records returned by REVIEW_RETURN, including applicability. */
export const reviewEvidenceItemSchema = z.object({
  id: z.string().uuid(),
  evidenceId: z.string().uuid(),
  title: z.string(),
  excerpt: z.string(),
  context: text,
  url: text,
  mediaType: text,
  author: text,
  publishedOn: text,
  capturedOn: text,
  locator: text,
  startSeconds: z.number().nonnegative().nullish(),
  endSeconds: z.number().nonnegative().nullish(),
  scope: z.enum(['MODEL', 'CONFIGURATION']),
  configurationId: text,
  modelId: text,
  kind: text,
  sentiment: text,
  conditions: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
});
export const reviewEvidenceResultSchema = envelope.extend({
  kind: z.literal('reviews'),
  items: z.array(reviewEvidenceItemSchema).max(30),
});
export type ReviewEvidenceResult = z.infer<typeof reviewEvidenceResultSchema>;

export const conceptResultSchema = envelope.extend({
  kind: z.literal('concepts'),
  items: z
    .array(
      attributeSchema.extend({
        aliases: z.array(z.string()),
        manufacturerTerms: z.array(
          z.object({
            term: z.string(),
            brand: text,
            model: text,
            market: text,
            language: text,
            model_year: z.number().nullish(),
            introduced_revision: z.number().nullish(),
            source_sha256: text,
            locator: text,
          }),
        ),
      }),
    )
    .max(30),
});

export const capabilityResultSchema = envelope.extend({
  kind: z.literal('capabilities'),
  items: z
    .array(
      z.object({
        configurationId: z.string().uuid(),
        name: z.string(),
        market: z.string(),
        modelYear: z.number(),
        identityStatus: z.string(),
        attributeCode: z.string(),
        availability: z.enum(['STANDARD', 'OPTIONAL']),
        observationId: z.string().uuid(),
        qualifiersJson: text,
        evidenceIds: z.array(z.string().uuid()),
        packages: z.array(
          z.object({ name: z.string(), availability: text, evidenceId: text }),
        ),
      }),
    )
    .max(30),
});

export const specificationExcerptSchema = z.object({
  recordType: z.literal('specification-excerpt'),
  evidenceId: z.string().uuid(),
  title: z.string(),
  excerpt: z.string(),
  locator: z.string(),
  path: z.string(),
  provenance: z.string(),
  upstreamUrls: z.array(z.string()),
});
export const evidenceExcerptResultSchema = envelope.extend({
  kind: z.literal('excerpts'),
  items: z
    .array(
      z.discriminatedUnion('recordType', [
        specificationExcerptSchema,
        reviewEvidenceItemSchema.extend({
          recordType: z.literal('review-passage'),
        }),
      ]),
    )
    .max(30),
});
