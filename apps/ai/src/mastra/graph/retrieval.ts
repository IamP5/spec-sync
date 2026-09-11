import { z } from 'zod';

import { knowledgeSchema } from '../catalog/contracts';
import { canonicalScope } from '../ingestion/manufacturers';
import { type GraphItem, type GraphQuery, withGraphRead } from './connection';
import {
  CAPABILITIES,
  CONCEPTS,
  REVIEW_EXPANSION,
  REVIEW_RETURN,
} from './queries';

export const attributeCodeSchema = z.string().regex(/^[a-z][a-z0-9_]{0,79}$/);
const querySchema = z.object({
  q: z.string().trim().max(500).default(''),
  limit: z.number().int().min(1).max(30).default(10),
  brand: z.string().trim().min(1).max(200).optional(),
  model: z.string().trim().min(1).max(200).optional(),
  attributeCode: attributeCodeSchema.optional(),
  market: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  modelYear: z.number().int().min(1900).max(2200).optional(),
  includeOptional: z.boolean().default(true),
  configurationId: z.string().uuid().optional(),
  embedding: z.array(z.number().finite()).max(4096).default([]),
});
export type GraphOperation =
  | 'concepts'
  | 'capabilities'
  | 'reviews'
  | 'related-reviews'
  | 'evidence';
type Knowledge = z.infer<typeof knowledgeSchema>;
const catalogMarker =
  "MATCH (p:CatalogProjection {id:'catalog'}) RETURN {version:p.fingerprint} AS item";
const reviewMarker =
  "MATCH (p:SpecSyncReview:ReviewProjection {id:'reviews'}) RETURN {version:p.fingerprint,embeddingModel:p.embedding_model} AS item";
const unavailable = (message: string): Knowledge => ({
  status: 'UNAVAILABLE',
  message,
  projectionVersion: null,
  items: [],
});

/** Literal fulltext terms, never a user-authored Lucene expression. */
export function literalSearch(text: string): string {
  return text
    .split(/\s+/u)
    .map((term) => term.replace(/[^\p{L}\p{N}_]/gu, ''))
    .filter(Boolean)
    .map((term) => `"${term}"`)
    .join(' OR ');
}

export async function retrieveGraph(
  operation: GraphOperation,
  input: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Knowledge> {
  try {
    return await withGraphRead(
      (query) => retrieveKnowledge(query, operation, input),
      signal,
    );
  } catch {
    return unavailable(
      'Graph retrieval failed or was cancelled. Retry or use the catalog comparison; no missing-data conclusion can be drawn.',
    );
  }
}

/** The fixed-query boundary is also exercised against real Neo4j in integration tests. */
export async function retrieveKnowledge(
  query: GraphQuery,
  operation: GraphOperation,
  input: Record<string, unknown>,
): Promise<Knowledge> {
  const q = querySchema.parse(input);
  if (operation === 'capabilities' && !q.attributeCode)
    throw new Error('Attribute required');
  if (
    operation === 'related-reviews' &&
    (!q.configurationId || !q.attributeCode)
  )
    throw new Error('Configuration and attribute required');
  if (operation === 'evidence') z.string().uuid().parse(q.q);
  const params: Record<string, unknown> = {
    q: q.q,
    limit: operation === 'evidence' ? 1 : q.limit,
    attributeCode: q.attributeCode ?? null,
    market: q.market ?? null,
    brand: q.brand ?? null,
    model: q.model
      ? canonicalScope(q.brand ?? '', q.model, q.modelYear ?? 0).model
      : null,
    year: q.modelYear ?? null,
    optional: q.includeOptional,
    configurationId: q.configurationId ?? null,
    modelId: null,
  };
  const catalog = (await query(catalogMarker))[0]?.['version'];
  if (typeof catalog !== 'string' || !catalog)
    return unavailable('Catalog graph has not been projected.');
  let reviewVersion: string | undefined = undefined;
  const result = async (
    items: GraphItem[],
    message?: string,
  ): Promise<Knowledge> => {
    if ((await query(catalogMarker))[0]?.['version'] !== catalog)
      return unavailable('Graph changed during retrieval; retry.');
    if (
      reviewVersion &&
      (await query(reviewMarker))[0]?.['version'] !== reviewVersion
    )
      return unavailable('Review index changed during retrieval; retry.');
    return knowledgeSchema.parse({
      status: items.length ? 'OK' : 'EMPTY',
      message:
        message ??
        (items.length
          ? 'Results from a derived graph snapshot; verify selected specification values through the catalog API.'
          : 'No matching indexed evidence in this snapshot.'),
      projectionVersion: reviewVersion
        ? `${catalog}/${reviewVersion}`
        : catalog,
      items,
    });
  };
  if (operation === 'concepts') return result(await query(CONCEPTS, params));
  if (operation === 'capabilities')
    return result(await query(CAPABILITIES, params));
  if (q.configurationId) {
    const configs = await query(
      'MATCH (c:SpecSyncCatalog:VehicleConfiguration {id:$configurationId}) RETURN {modelId:c.model_id} AS item',
      params,
    );
    if (!configs.length)
      return result(
        [],
        'Configuration is absent from this graph snapshot; resolve it in the catalog.',
      );
    params['modelId'] = configs[0]?.['modelId'] ?? null;
  }
  if (operation === 'evidence') {
    const evidence = await query(
      `
      MATCH (e:SpecSyncCatalog:Evidence {id:$q})-[:FROM_REVISION]->(s:SourceRevision)
      RETURN {evidenceId:e.id, excerpt:e.excerpt, locator:e.locator, title:s.title,
        path:s.path, provenance:s.provenance, upstreamUrls:s.upstream_urls} AS item`,
      params,
    );
    if (evidence.length) return result(evidence);
  }
  const reviews = (await query(reviewMarker))[0];
  if (typeof reviews?.['version'] !== 'string' || !reviews['version'])
    return unavailable(
      'No review index is available. External discovery can find links, but cannot supply verified quotations.',
    );
  reviewVersion = reviews['version'];
  if (operation === 'evidence')
    return result(
      await query(
        REVIEW_EXPANSION + ' AND chunk.id=$q\n' + REVIEW_RETURN,
        params,
      ),
    );
  if (!q.q || operation === 'related-reviews')
    return result(await query(REVIEW_EXPANSION + REVIEW_RETURN, params));

  const search = literalSearch(q.q);
  params['search'] = search;
  params['candidateLimit'] = Math.min(300, q.limit * 10);
  const lexical = search
    ? await query(
        `
    CALL db.index.fulltext.queryNodes('review_text',$search) YIELD node,score
    RETURN {id:node.id,score:score} AS item ORDER BY item.score DESC LIMIT $candidateLimit`,
        params,
      )
    : [];
  let semantic: GraphItem[] = [];
  if (q.embedding.length) {
    const model = process.env['SPECSYNC_REVIEW_EMBEDDING_MODEL'];
    if (!model || model !== reviews['embeddingModel'])
      return unavailable(
        'The query embedding model does not match the indexed review model.',
      );
    params['embedding'] = q.embedding;
    semantic = await query(
      `
      CALL db.index.vector.queryNodes('review_embedding',$candidateLimit,$embedding) YIELD node,score
      RETURN {id:node.id,score:score} AS item ORDER BY item.score DESC`,
      params,
    );
  }
  const ranks = new Map<string, number>();
  for (const list of [lexical, semantic])
    list.forEach((item, index) => {
      const id = String(item['id']);
      ranks.set(id, (ranks.get(id) ?? 0) + 1 / (60 + index + 1));
    });
  params['chunkIds'] = [...ranks.keys()];
  params['limit'] = 300;
  const expanded = await query(
    REVIEW_EXPANSION + ' AND chunk.id IN $chunkIds\n' + REVIEW_RETURN,
    params,
  );
  expanded.sort(
    (a, b) =>
      (ranks.get(String(b['evidenceId'])) ?? 0) -
        (ranks.get(String(a['evidenceId'])) ?? 0) ||
      String(a['id']).localeCompare(String(b['id'])),
  );
  return result(expanded.slice(0, q.limit));
}
