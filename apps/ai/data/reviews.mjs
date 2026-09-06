import { readFile } from 'node:fs/promises';
import { neo4j, postgres } from './database.mjs';
import { sha256 } from './foundation.mjs';

/** Projects existing reviewed content; never fetches, extracts, or creates source content. */
export async function projectReviews() {
  const tables = [
    'attribute_alias',
    'review_source_revision',
    'review_chunk',
    'review_aspect',
    'review_aspect_attribute',
    'review_observation',
  ];
  const snapshot = JSON.parse(
    await postgres(
      `SELECT jsonb_build_object(${tables.map((t) => `'${t}',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM catalog.${t} x)`).join(',')});`,
    ),
  );
  const statements = [
    { statement: 'MATCH (n:SpecSyncReview) DETACH DELETE n' },
  ];
  for (const [table, label] of [
    ['attribute_alias', 'AttributeAlias'],
    ['review_source_revision', 'SourceRevision'],
    ['review_chunk', 'ContentChunk'],
    ['review_aspect', 'ReviewAspect'],
    ['review_observation', 'ReviewObservation'],
  ]) {
    statements.push({
      statement: `UNWIND $rows AS row CREATE (n:SpecSyncReview:${label}) SET n = row`,
      parameters: { rows: snapshot[table] },
    });
  }
  statements.push({
    statement: `MATCH (a:SpecSyncReview:AttributeAlias),(d:SpecSyncCatalog:AttributeDefinition) WHERE a.attribute_id=d.id SET a:SpecSyncCatalog CREATE (a)-[:ALIAS_OF]->(d)`,
  });
  statements.push({
    statement: `MATCH (c:SpecSyncReview:ContentChunk),(s:SpecSyncReview:SourceRevision) WHERE c.source_revision_id=s.id CREATE (c)-[:FROM_REVISION]->(s)`,
  });
  statements.push({
    statement: `MATCH (o:SpecSyncReview:ReviewObservation),(c:SpecSyncReview:ContentChunk),(a:SpecSyncReview:ReviewAspect) WHERE o.chunk_id=c.id AND o.aspect_id=a.id CREATE (o)-[:SUPPORTED_BY]->(c) CREATE (o)-[:ABOUT]->(a)`,
  });
  statements.push({
    statement: `UNWIND $rows AS row MATCH (a:SpecSyncReview:ReviewAspect {id:row.aspect_id}), (d:SpecSyncCatalog:AttributeDefinition {id:row.attribute_id}) CREATE (a)-[:RELATES_TO]->(d)`,
    parameters: { rows: snapshot.review_aspect_attribute },
  });
  statements.push({
    statement: `CREATE (:SpecSyncReview:ReviewProjection {id:'reviews',fingerprint:$fingerprint,embedding_model:$embeddingModel,projected_at:datetime()})`,
    parameters: {
      fingerprint: sha256(JSON.stringify(snapshot)),
      embeddingModel:
        snapshot.review_chunk.find((c) => c.embedding)?.embedding_model ?? null,
    },
  });
  await neo4j([
    {
      statement:
        'CREATE FULLTEXT INDEX review_text IF NOT EXISTS FOR (c:ContentChunk) ON EACH [c.text]',
    },
  ]);
  const embedded = snapshot.review_chunk.filter((c) => c.embedding);
  if (embedded.length) {
    const models = new Set(embedded.map((c) => c.embedding_model));
    const dimensions = new Set(embedded.map((c) => c.embedding.length));
    if (
      models.size !== 1 ||
      dimensions.size !== 1 ||
      !embedded.every((c) => c.embedding.every(Number.isFinite))
    )
      throw new Error('Review embeddings must use one model and dimension.');
    const dimension = embedded[0].embedding.length;
    if (dimension < 1 || dimension > 4096)
      throw new Error('Invalid embedding dimensions');
    await neo4j([
      {
        statement: `CREATE VECTOR INDEX review_embedding IF NOT EXISTS FOR (c:ContentChunk) ON c.embedding OPTIONS {indexConfig: {\`vector.dimensions\`: ${dimension}, \`vector.similarity_function\`: 'cosine'}}`,
      },
    ]);
  }
  await neo4j(statements);
  console.log(
    `Review projection ready: ${snapshot.review_observation.length} observations (no ingestion).`,
  );
}

export async function seedAttributeAliases() {
  await postgres(
    await readFile(
      new URL(
        '../../api/src/main/resources/db/migration/V4__attribute_terminology.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
}
