import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { catalogRequest, withToolFailure } from '../catalog/api-client';
import {
  catalogSearchInputSchema,
  catalogSearchOutputSchema,
  searchCatalog,
} from '../catalog/catalog-search';
import {
  attributeSchema,
  comparisonSchema,
  failureSchema,
  selectionSchema,
  singleSelectionSchema,
} from '../catalog/contracts';
import {
  capabilityResultSchema,
  conceptResultSchema,
  evidenceExcerptResultSchema,
  retrieveReviewEvidence,
  retrieveTypedKnowledge,
  reviewEvidenceResultSchema,
} from '../catalog/knowledge-results';
import { attributeCodeSchema } from '../graph/retrieval';

export const searchVehicleConfigurations = createTool({
  id: 'searchVehicleConfigurations',
  description:
    'Find and display ONE interactive vehicle catalog. Put ALL vehicles named in the request into the searches array in ONE call, for example searches: [{q: "BYD Shark"}, {q: "Ford Ranger"}]. The server retrieves and returns their authoritative configurations together; CopilotKit renders that single result. Do not issue one tool call per vehicle or copy facts into a separate UI tool. Broaden only searches reported empty, preserve requested market/year, and never select an ambiguous trim silently. For more results, pass the returned nextSearches as searches.',
  inputSchema: catalogSearchInputSchema,
  outputSchema: catalogSearchOutputSchema,
  inputExamples: [
    { input: { searches: [{ q: 'BYD Shark' }, { q: 'Ford Ranger' }] } },
  ],
  execute: (input, context) => searchCatalog(input, context?.abortSignal),
});
export const listComparisonAttributes = createTool({
  id: 'listComparisonAttributes',
  description:
    'List canonical attribute codes, meanings, types and units. Use these codes when comparing; unsupported requested attributes must be reported.',
  inputSchema: z.object({}),
  outputSchema: z.union([
    z.object({ items: z.array(attributeSchema) }),
    failureSchema,
  ]),
  execute: (_input, context) =>
    withToolFailure(() =>
      catalogRequest(
        '/api/comparison-attributes',
        {},
        z.object({ items: z.array(attributeSchema) }),
        context?.abortSignal,
      ),
    ),
});
export const compareVehicleConfigurations = createTool({
  id: 'compareVehicleConfigurations',
  description:
    'Compare 2–5 resolved configuration UUIDs. Returns authoritative ordered cells with accepted observations, conflicts, missing data and exact sources. The browser renders this result directly.',
  inputSchema: selectionSchema,
  outputSchema: z.union([comparisonSchema, failureSchema]),
  execute: (input, context) =>
    withToolFailure(() =>
      catalogRequest(
        '/api/comparisons',
        input,
        comparisonSchema,
        context?.abortSignal,
      ),
    ),
});
export const getVehicleSpecifications = createTool({
  id: 'getVehicleSpecifications',
  description:
    'Retrieve specifications and sources for exactly one resolved configuration UUID.',
  inputSchema: singleSelectionSchema,
  outputSchema: z.union([comparisonSchema, failureSchema]),
  execute: (input, context) =>
    withToolFailure(() =>
      catalogRequest(
        '/api/vehicle-specifications',
        input,
        comparisonSchema,
        context?.abortSignal,
      ),
    ),
});
const conceptInput = z.object({
  q: z.string().max(500),
  brand: z.string().max(150).optional(),
  model: z.string().max(150).optional(),
  market: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  modelYear: z.number().int().min(1900).max(2200).optional(),
  limit: z.number().int().min(1).max(30).default(10),
});
export const resolveComparisonConcepts = createTool({
  id: 'resolveComparisonConcepts',
  description:
    'Resolve terminology against curated graph attribute definitions and aliases. Pass brand, model, market and modelYear when resolving manufacturer wording; manufacturer terms remain scoped and are not global synonyms. No match is not proof of functional inequivalence; use listComparisonAttributes as fallback.',
  inputSchema: conceptInput,
  outputSchema: z.union([conceptResultSchema, failureSchema]),
  execute: (input, context) =>
    withToolFailure(() =>
      retrieveTypedKnowledge('concepts', input, context?.abortSignal),
    ),
});
const capabilityInput = z.object({
  attributeCode: attributeCodeSchema,
  market: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  modelYear: z.number().int().min(1900).max(2200).optional(),
  includeOptional: z.boolean().default(true),
  limit: z.number().int().min(1).max(30).default(10),
});
export const findConfigurationsByCapabilities = createTool({
  id: 'findConfigurationsByCapabilities',
  description:
    'Find configurations with an accepted STANDARD or optionally OPTIONAL equipment attribute, including package evidence. Resolve attribute first. This graph snapshot can lag: confirm specifications through the catalog; empty results do not prove absence.',
  inputSchema: capabilityInput,
  outputSchema: z.union([capabilityResultSchema, failureSchema]),
  execute: (input, context) =>
    withToolFailure(() =>
      retrieveTypedKnowledge('capabilities', input, context?.abortSignal),
    ),
});
const reviewInput = z.object({
  q: z.string().max(500).default(''),
  configurationId: z.string().uuid().optional(),
  attributeCode: attributeCodeSchema.optional(),
  limit: z.number().int().min(1).max(30).default(10),
});
export const searchReviewEvidence = createTool({
  id: 'searchReviewEvidence',
  description:
    'Search existing indexed review passages, scoped to a configuration and optionally a specification. Returns exact excerpts, context, opinion kind and model/configuration scope. Never ingests content.',
  inputSchema: reviewInput,
  outputSchema: z.union([reviewEvidenceResultSchema, failureSchema]),
  execute: (input, context) =>
    withToolFailure(() => retrieveReviewEvidence(input, context?.abortSignal)),
});
const relatedInput = z.object({
  configurationId: z.string().uuid(),
  attributeCode: attributeCodeSchema,
  limit: z.number().int().min(1).max(30).default(10),
});
export const getRelatedReviews = createTool({
  id: 'getRelatedReviews',
  description:
    'Find indexed review observations related to one specification. Related opinion is not evidence proving the technical specification.',
  inputSchema: relatedInput,
  outputSchema: z.union([reviewEvidenceResultSchema, failureSchema]),
  execute: (input, context) =>
    withToolFailure(() =>
      retrieveTypedKnowledge('related-reviews', input, context?.abortSignal),
    ),
});
export const getEvidenceExcerpt = createTool({
  id: 'getEvidenceExcerpt',
  description:
    'Retrieve exact stored specification or review evidence by UUID. Use only returned excerpts for quotations; source discovery snippets are not verified quotes.',
  inputSchema: z.object({ evidenceId: z.string().uuid() }),
  outputSchema: z.union([evidenceExcerptResultSchema, failureSchema]),
  execute: (input, context) =>
    withToolFailure(() =>
      retrieveTypedKnowledge(
        'evidence',
        { q: input.evidenceId },
        context?.abortSignal,
      ),
    ),
});
export const vehicleTools = {
  searchVehicleConfigurations,
  listComparisonAttributes,
  compareVehicleConfigurations,
  getVehicleSpecifications,
  resolveComparisonConcepts,
  findConfigurationsByCapabilities,
  searchReviewEvidence,
  getRelatedReviews,
  getEvidenceExcerpt,
};
