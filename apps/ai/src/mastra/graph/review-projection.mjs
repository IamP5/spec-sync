import { createHash } from 'node:crypto';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function reviewProjectionStatements(snapshot) {
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
  return statements;
}
