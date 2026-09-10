import { createHash } from 'node:crypto';

import { z } from 'zod';

const text = z.string().min(1);
const qualifiers = z.record(z.string());

export const vehicleSchema = z
  .object({
    id: text,
    market: z.literal('BR'),
    make: text,
    model: text,
    modelYear: z.number().int().min(1886).max(2200).nullable(),
    trim: text,
    bodyType: text,
  })
  .strict();

export const evidenceSchema = z
  .object({
    sourceId: text,
    revision: text,
    lineStart: z.number().int().positive(),
    lineEnd: z.number().int().positive(),
    headerLine: z.number().int().positive().nullable(),
    column: z.number().int().positive().nullable(),
    quote: text,
  })
  .strict()
  .refine((value) => value.lineEnd >= value.lineStart, {
    message: 'Evidence lineEnd precedes lineStart',
  });

const claimShape = {
  vehicleId: text,
  field: text,
  rawValue: z.string().nullable(),
  unit: z.string().nullable(),
  qualifiers,
  availability: z.enum(['value', 'standard', 'optional', 'unavailable']),
  evidence: z.array(evidenceSchema).min(1),
};
const validClaim = (value) =>
  value.availability !== 'value' || value.rawValue !== null;
export const goldClaimSchema = z
  .object(claimShape)
  .strict()
  .refine(validClaim, {
    message: 'Value claims require rawValue',
  });
export const claimSchema = z
  .object({
    ...claimShape,
    confidence: z.number().finite().min(0).max(1).nullable().default(null),
  })
  .strict()
  .refine(validClaim, { message: 'Value claims require rawValue' });

export const abstentionSchema = z
  .object({
    vehicleId: text,
    field: text,
    qualifiers,
    reason: z.enum(['not-stated', 'conflicting']),
    evidence: z.array(evidenceSchema).min(1),
  })
  .strict();

const resolutionSchema = z
  .object({
    status: z.enum(['resolved', 'needs-clarification', 'not-found']),
    vehicleIds: z.array(text),
  })
  .strict();

export const predictionSchema = z
  .object({
    resolution: resolutionSchema,
    variants: z.array(vehicleSchema),
    claims: z.array(claimSchema),
    abstentions: z.array(abstentionSchema),
  })
  .strict();

const sourceSchema = z
  .object({
    id: text,
    revision: text,
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    url: z.string().url(),
    format: z.enum(['synthetic-tsv-v1', 'text-v1']),
    text,
  })
  .strict();

export const inputSchema = z
  .object({
    query: text,
    requested: z
      .object({
        market: z.literal('BR'),
        make: text,
        model: text,
        modelYear: z.number().int().nullable(),
        trim: text.nullable(),
      })
      .strict(),
    sources: z.array(sourceSchema).min(1),
  })
  .strict();

export const goldSchema = z
  .object({
    resolution: resolutionSchema,
    variants: z.array(vehicleSchema),
    claims: z.array(goldClaimSchema),
    abstentions: z.array(abstentionSchema),
  })
  .strict();

export const datasetSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: text,
    revision: text,
    synthetic: z.boolean(),
    provenance: z.enum(['synthetic', 'curated-notes', 'manufacturer-reviewed']),
    description: text,
    cases: z
      .array(
        z
          .object({
            id: text,
            tags: z.array(text).min(1),
            input: inputSchema,
            gold: goldSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function stable(value) {
  if (Array.isArray(value))
    return JSON.stringify(value.map((item) => JSON.parse(stable(item))));
  if (value !== null && typeof value === 'object') {
    return JSON.stringify(
      Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, JSON.parse(stable(value[key]))]),
      ),
    );
  }
  return JSON.stringify(value);
}

export function claimKey(claim) {
  return stable(
    Object.fromEntries(
      Object.entries(claim).filter(
        ([key]) => key !== 'evidence' && key !== 'confidence',
      ),
    ),
  );
}

export function abstentionKey(item) {
  return stable(
    Object.fromEntries(
      Object.entries(item).filter(([key]) => key !== 'evidence'),
    ),
  );
}

export function evidenceExists(evidence, sources) {
  const source = sources.find(
    (item) =>
      item.id === evidence.sourceId && item.revision === evidence.revision,
  );
  if (!source || digest(source.text) !== source.sha256) return false;
  const lines = source.text.split('\n');
  if (
    evidence.lineEnd > lines.length ||
    (evidence.headerLine !== null && evidence.headerLine > lines.length)
  )
    return false;
  const quoteMatches =
    lines.slice(evidence.lineStart - 1, evidence.lineEnd).join('\n') ===
    evidence.quote;
  if (source.format === 'text-v1') return quoteMatches;
  if (evidence.headerLine === null || evidence.column === null) return false;
  const header = lines[evidence.headerLine - 1].split('\t');
  return (
    header[0] === 'columns' && evidence.column < header.length && quoteMatches
  );
}

export function validateDataset(raw) {
  const dataset = datasetSchema.parse(raw);
  if (dataset.synthetic !== (dataset.provenance === 'synthetic'))
    throw new Error('Dataset provenance conflicts with synthetic flag');
  const caseIds = new Set();
  for (const item of dataset.cases) {
    if (caseIds.has(item.id)) throw new Error(`Duplicate case id: ${item.id}`);
    caseIds.add(item.id);
    const sources = new Set();
    for (const source of item.input.sources) {
      if (sources.has(source.id))
        throw new Error(`Duplicate source id in ${item.id}`);
      sources.add(source.id);
      if (digest(source.text) !== source.sha256)
        throw new Error(`Source digest mismatch: ${source.id}`);
    }
    const vehicleIds = new Set(item.gold.variants.map((vehicle) => vehicle.id));
    if (vehicleIds.size !== item.gold.variants.length)
      throw new Error(`Duplicate gold variant in ${item.id}`);
    for (const entries of [item.gold.claims, item.gold.abstentions]) {
      const keys = new Set();
      for (const entry of entries) {
        const key =
          'availability' in entry ? claimKey(entry) : abstentionKey(entry);
        if (keys.has(key))
          throw new Error(`Duplicate gold entry in ${item.id}`);
        keys.add(key);
        if (!vehicleIds.has(entry.vehicleId))
          throw new Error(`Unknown gold vehicle in ${item.id}`);
        if (
          !entry.evidence.every((evidence) =>
            evidenceExists(evidence, item.input.sources),
          )
        ) {
          throw new Error(`Invalid gold evidence in ${item.id}`);
        }
        for (const evidence of entry.evidence) {
          const source = item.input.sources.find(
            (value) => value.id === evidence.sourceId,
          );
          if (source.format !== 'synthetic-tsv-v1') continue;
          const header = source.text
            .split('\n')
            [evidence.headerLine - 1].split('\t');
          if (header[evidence.column] !== entry.vehicleId)
            throw new Error(`Wrong gold evidence column in ${item.id}`);
        }
      }
    }
    if (!item.gold.resolution.vehicleIds.every((id) => vehicleIds.has(id)))
      throw new Error(`Unknown resolved vehicle in ${item.id}`);
  }
  return dataset;
}
