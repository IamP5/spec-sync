import { readFile } from 'node:fs/promises';
import { neo4j, postgres } from './database.mjs';
import { reviewProjectionStatements } from '../src/mastra/graph/review-projection.mjs';

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
  const statements = reviewProjectionStatements(snapshot);
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
  // Alias migrations join catalog.attribute_definition, so they are re-run after
  // the seed creates the definitions they name.
  for (const migration of [
    'V4__attribute_terminology.sql',
    'V18__raptor_terminology.sql',
  ]) {
    await postgres(
      await readFile(
        new URL(
          `../../api/src/main/resources/db/migration/${migration}`,
          import.meta.url,
        ),
        'utf8',
      ),
    );
  }
}
