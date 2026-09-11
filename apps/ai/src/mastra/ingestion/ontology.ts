import { z } from 'zod';

import { canonicalScope } from './manufacturers';

export const ontologyVersionFields = {
  ontologyRevision: z.number().int().nonnegative().optional(),
  normalizationRevision: z.string().min(1).max(100).optional(),
  readerRevision: z.string().max(250).optional(),
};

export const terminologySchema = z.object({
  attributeCode: z.string(),
  term: z.string().min(1).max(250),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  market: z.string().nullable(),
  language: z.string().nullable(),
  modelYear: z.number().int().nullable(),
});
export type Terminology = z.infer<typeof terminologySchema>;
export const attributeValueSchema = z.object({
  attributeCode: z.string(),
  code: z.string(),
  aliases: z.array(z.string()).max(100),
});

/** Advisory data only: the API owns validation, activation and revision changes. */
export const ontologyProposalSchema = z.object({
  kind: z.enum([
    'ADD_ATTRIBUTE',
    'ADD_ALIAS',
    'EXTEND_VOCABULARY',
    'REVIEW_SEMANTICS',
  ]),
  attributeCode: z.string().max(80).nullable(),
  proposedCode: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_]{0,79}$/)
    .nullable(),
  label: z.string().max(250).nullable(),
  definition: z.string().min(1).max(2000),
  valueType: z.enum(['NUMBER', 'TEXT', 'LIST', 'AVAILABILITY']),
  unit: z.string().max(80).nullable(),
  dimension: z.string().max(100).nullable(),
  alternatives: z.array(z.string().max(500)).max(10),
});

export const unmappedObservationSchema = z.object({
  originalTerm: z.string().min(1).max(250),
  termOrigin: z.enum(['SOURCE_TEXT', 'VISUAL_LABEL', 'DERIVED_TEXT']),
  rawValue: z.string().min(1).max(2000),
  sourceUnit: z.string().max(80).nullable(),
  qualifiers: z.record(z.string()),
  lineStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  excerpt: z.string(),
  locator: z.string().min(1).max(1000),
  proposal: ontologyProposalSchema.nullable(),
});
export type UnmappedObservation = z.infer<typeof unmappedObservationSchema>;

/** Accent, case and whitespace normalization is linguistic; punctuation and meaning are retained. */
export const termKey = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();

export function resolveTerm(
  term: string,
  scope: { brand: string; model: string; market: string; modelYear: number },
  terminology: readonly Terminology[],
): string | undefined {
  const modelKey = (brand: string, model: string) =>
    termKey(canonicalScope(brand, model, scope.modelYear).model);
  const matches = terminology.filter(
    (candidate) =>
      termKey(candidate.term) === termKey(term) &&
      (!candidate.brand || termKey(candidate.brand) === termKey(scope.brand)) &&
      (!candidate.model ||
        modelKey(candidate.brand ?? scope.brand, candidate.model) ===
          modelKey(scope.brand, scope.model)) &&
      (!candidate.market || candidate.market === scope.market) &&
      (!candidate.language ||
        ['pt', 'pt-br'].includes(candidate.language.toLowerCase())) &&
      (candidate.modelYear === null || candidate.modelYear === scope.modelYear),
  );
  // Contradictory aliases never become an automatic match, including a broad
  // alias that conflicts with a manufacturer-specific definition.
  const codes = new Set(matches.map((candidate) => candidate.attributeCode));
  return codes.size === 1 ? [...codes][0] : undefined;
}
