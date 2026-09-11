import { z } from 'zod';

import { parseResult } from '../util/parse-result';
import {
  capabilityResultSchema,
  conceptResultSchema,
  evidenceExcerptResultSchema,
  reviewEvidenceResultSchema,
  specificationExcerptSchema,
} from './knowledge-contracts';

const sourceItem = z.object({
  title: z.string(),
  url: z.string(),
  documentType: z.enum(['PDF', 'HTML']).optional(),
  sourceType: z
    .enum([
      'MANUFACTURER_WEBSITE',
      'LINKED_FROM_MANUFACTURER',
      'EXTERNAL_WEBSITE',
    ])
    .optional(),
  applicability: z.literal('UNVERIFIED').optional(),
  availability: z
    .enum(['READABLE', 'OVERSIZE', 'UNREACHABLE', 'UNKNOWN'])
    .optional(),
  yearHint: z.number().nullable().optional(),
  modelMatch: z.boolean().optional(),
});
const sourceResult = z.object({
  status: z.enum(['OK', 'EMPTY', 'ERROR']),
  message: z.string().default(''),
  items: z.array(sourceItem),
  // Earlier persisted discovery responses allowed an opaque warnings object.
  // Its contents are not interpreted as presentation or evidence.
  warnings: z
    .union([z.array(z.string()), z.record(z.unknown())])
    .optional()
    .transform((warnings) => (Array.isArray(warnings) ? warnings : [])),
});
const contentResult = z.object({
  status: z.enum(['OK', 'EMPTY']),
  message: z.string().default(''),
  items: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      verification: z.literal('DISCOVERED_LINK').optional(),
    }),
  ),
});
const failure = z.object({
  status: z.literal('ERROR'),
  message: z.string(),
  retryable: z.boolean().default(false),
});
const attributeResult = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      code: z.string(),
      label: z.string(),
      description: z.string().nullable(),
      valueType: z.string(),
      unit: z.string().nullable(),
    }),
  ),
});
// Existing persisted tool results predate the kind discriminator. Their exact
// operation-specific schemas remain readable; unknown object fields do not pick UI.
const reviews = reviewEvidenceResultSchema.extend({
  kind: z.literal('reviews').default('reviews'),
});
const capabilities = capabilityResultSchema.extend({
  kind: z.literal('capabilities').default('capabilities'),
});
const concepts = conceptResultSchema.extend({
  kind: z.literal('concepts').default('concepts'),
});
const legacySpecificationExcerpts = evidenceExcerptResultSchema
  .omit({ kind: true, items: true })
  .extend({
    items: z.array(specificationExcerptSchema.omit({ recordType: true })),
  });

export type KnowledgeView =
  | { kind: 'sources'; data: z.infer<typeof sourceResult> }
  | { kind: 'content'; data: z.infer<typeof contentResult> }
  | { kind: 'reviews'; data: z.infer<typeof reviewEvidenceResultSchema> }
  | { kind: 'capabilities'; data: z.infer<typeof capabilityResultSchema> }
  | { kind: 'concepts'; data: z.infer<typeof conceptResultSchema> }
  | { kind: 'excerpts'; data: z.infer<typeof evidenceExcerptResultSchema> }
  | { kind: 'attributes'; data: z.infer<typeof attributeResult> }
  | { kind: 'failure'; data: z.infer<typeof failure> };

/** The registered operation selects one dedicated schema, never a field heuristic. */
export function knowledgeView(
  name: string,
  value: unknown,
): KnowledgeView | undefined {
  switch (name) {
    case 'discoverVehicleSpecificationSources': {
      const data = parseResult(value, sourceResult);
      if (data) return { kind: 'sources', data };
      break;
    }
    case 'discoverVehicleContent': {
      const data = parseResult(value, contentResult);
      if (data) return { kind: 'content', data };
      break;
    }
    case 'searchReviewEvidence':
    case 'getRelatedReviews': {
      const data = parseResult(value, reviews);
      if (data) return { kind: 'reviews', data };
      break;
    }
    case 'findConfigurationsByCapabilities': {
      const data = parseResult(value, capabilities);
      if (data) return { kind: 'capabilities', data };
      break;
    }
    case 'resolveComparisonConcepts': {
      const data = parseResult(value, concepts);
      if (data) return { kind: 'concepts', data };
      break;
    }
    case 'getEvidenceExcerpt': {
      const data = parseResult(value, evidenceExcerptResultSchema);
      if (data) return { kind: 'excerpts', data };
      // Explicit pre-discriminator graph contracts, restricted to this tool.
      const specifications = parseResult(value, legacySpecificationExcerpts);
      if (specifications)
        return {
          kind: 'excerpts',
          data: {
            ...specifications,
            kind: 'excerpts',
            items: specifications.items.map((item) => ({
              ...item,
              recordType: 'specification-excerpt',
            })),
          },
        };
      const review = parseResult(value, reviews);
      if (review)
        return {
          kind: 'excerpts',
          data: {
            ...review,
            kind: 'excerpts',
            items: review.items.map((item) => ({
              ...item,
              recordType: 'review-passage',
            })),
          },
        };
      break;
    }
    case 'listComparisonAttributes': {
      const data = parseResult(value, attributeResult);
      if (data) return { kind: 'attributes', data };
      break;
    }
  }
  const data = parseResult(value, failure);
  return data ? { kind: 'failure', data } : undefined;
}

export function reviewExcerpt(
  result: z.infer<typeof evidenceExcerptResultSchema>,
  item: z.infer<typeof evidenceExcerptResultSchema>['items'][number],
): z.infer<typeof reviewEvidenceResultSchema> | undefined {
  return item.recordType === 'review-passage'
    ? {
        kind: 'reviews',
        status: result.status,
        message: '',
        projectionVersion: result.projectionVersion,
        items: [item],
      }
    : undefined;
}
