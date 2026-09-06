import neo4j from 'neo4j-driver';
import { z } from 'zod';

import {
  projectionConstraints,
  projectionStatements,
} from './catalog-projection.mjs';
import { reviewProjectionStatements } from './review-projection.mjs';
import { createHash } from 'node:crypto';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const tables = [
  'brand',
  'vehicle_model',
  'vehicle_configuration',
  'attribute_definition',
  'source_revision',
  'evidence',
  'spec_assertion',
  'assertion_evidence',
  'accepted_specification',
  'feature_package',
  'package_item',
  'configuration_package',
  'seed_dataset',
  'attribute_alias',
  'review_source_revision',
  'review_chunk',
  'review_aspect',
  'review_aspect_attribute',
  'review_observation',
];
export const projectionInput = z
  .object({
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    snapshot: z.record(z.array(z.record(z.unknown()))),
  })
  .refine(
    (input) => tables.every((table) => Array.isArray(input.snapshot[table])),
    'Incomplete projection snapshot',
  );
function parameters(value) {
  if (typeof value === 'number' && Number.isInteger(value))
    return neo4j.int(value);
  if (Array.isArray(value)) return value.map(parameters);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, parameters(item)]),
    );
  return value;
}
export async function projectIngestion(input) {
  input = projectionInput.parse(input);
  const uri = process.env['SPECSYNC_INGESTION_NEO4J_URI'];
  const username = process.env['SPECSYNC_INGESTION_NEO4J_USERNAME'];
  const password = process.env['SPECSYNC_INGESTION_NEO4J_PASSWORD'];
  if (!uri || !username || !password)
    throw new Error('Ingestion graph writer is not configured.');
  if (process.env['NODE_ENV'] === 'production' && !uri.startsWith('neo4j+s://'))
    throw new Error('Graph writer requires verified TLS.');
  const driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
    maxConnectionPoolSize: 2,
    connectionTimeout: 5000,
    maxTransactionRetryTime: 0,
  });
  const session = driver.session({
    database: process.env['SPECSYNC_INGESTION_NEO4J_DATABASE'] ?? 'neo4j',
  });
  try {
    for (const { statement } of projectionConstraints)
      await session.run(statement);
    await session.run(
      'CREATE CONSTRAINT ingestion_projection_lock IF NOT EXISTS FOR (n:IngestionProjectionLock) REQUIRE n.id IS UNIQUE',
    );
    await session.run(
      'CREATE FULLTEXT INDEX review_text IF NOT EXISTS FOR (c:ContentChunk) ON EACH [c.text]',
    );
    const embedded = (input.snapshot['review_chunk'] ?? []).filter((chunk) =>
      Array.isArray(chunk['embedding']),
    );
    if (embedded.length) {
      const dimensions = new Set(
        embedded.map((chunk) => chunk['embedding'].length),
      );
      const models = new Set(embedded.map((chunk) => chunk['embedding_model']));
      const dimension = [...dimensions][0] ?? 0;
      if (
        dimensions.size !== 1 ||
        models.size !== 1 ||
        dimension < 1 ||
        dimension > 4096 ||
        !embedded.every((chunk) =>
          chunk['embedding'].every(
            (value) => typeof value === 'number' && Number.isFinite(value),
          ),
        )
      )
        throw new Error(
          'Review embedding model or dimensions are inconsistent.',
        );
      await session.run(
        `CREATE VECTOR INDEX review_embedding IF NOT EXISTS FOR (c:ContentChunk) ON c.embedding OPTIONS {indexConfig: {\`vector.dimensions\`: ${dimension}, \`vector.similarity_function\`: 'cosine'}}`,
      );
    }
    await session.executeWrite(
      async (tx) => {
        // An independent lock survives replacement of the owned projection nodes.
        await tx.run(
          "MERGE (l:IngestionProjectionLock {id:'catalog'}) SET l.updated_at=datetime()",
        );
        const current = await tx.run(
          "MATCH (p:SpecSyncCatalog:CatalogProjection {id:'catalog'}) RETURN p.ingestion_revision AS revision",
        );
        const revision = current.records[0]?.get('revision');
        if (revision != null && Number(revision) >= input.revision) return;
        const catalog = Object.fromEntries(
          tables
            .slice(0, 13)
            .map((table) => [table, input.snapshot[table] ?? []]),
        );
        const reviews = Object.fromEntries(
          tables.slice(13).map((table) => [table, input.snapshot[table] ?? []]),
        );
        for (const item of [
          ...projectionStatements(catalog, sha256(JSON.stringify(catalog))),
          ...reviewProjectionStatements(reviews),
        ])
          await tx.run(item.statement, parameters(item.parameters ?? {}));
        await tx.run(
          "MATCH (p:SpecSyncCatalog:CatalogProjection {id:'catalog'}) SET p.ingestion_revision=$revision",
          { revision: neo4j.int(input.revision) },
        );
      },
      { timeout: 120000 },
    );
  } finally {
    await session.close();
    await driver.close();
  }
}
