import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import neo4j, { type Driver } from 'neo4j-driver';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import { closeGraph } from './connection';
import { retrieveGraph } from './retrieval';

const config = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1';
const evidence = randomUUID();
const marker = randomUUID();
let fixtureDriver: Driver;
async function fixture(cypher: string, params: Record<string, unknown> = {}) {
  return fixtureDriver.executeQuery(
    cypher,
    { marker, config, evidence, ...params },
    { database: 'neo4j' },
  );
}
beforeAll(async () => {
  // Always local, even when the caller has Aura credentials in their environment.
  const address = execFileSync(
    'docker',
    ['compose', '-f', '../../compose.yaml', 'port', 'neo4j', '7687'],
    { encoding: 'utf8' },
  ).trim();
  expect(address).toMatch(/^127\.0\.0\.1:\d+$/);
  vi.stubEnv('NEO4J_URI', `bolt://${address}`);
  vi.stubEnv('NEO4J_USERNAME', 'neo4j');
  vi.stubEnv('NEO4J_PASSWORD', 'specsync-local');
  vi.stubEnv('NEO4J_DATABASE', 'neo4j');
  vi.stubEnv('NODE_ENV', 'test');
  fixtureDriver = neo4j.driver(
    `bolt://${address}`,
    neo4j.auth.basic('neo4j', 'specsync-local'),
  );
  await fixture(
    `
    MATCH (configuration:SpecSyncCatalog:VehicleConfiguration {id:$config})
    MATCH (attribute:SpecSyncCatalog:AttributeDefinition {code:'rear_suspension'})
    CREATE (source:SpecSyncReview:SourceRevision {test_run:$marker,id:$marker,title:'Synthetic review fixture',url:'https://example.com/test-review',media_type:'ARTICLE'})
    CREATE (chunk:SpecSyncReview:ContentChunk {test_run:$marker,id:$evidence,text:'Test: firm ride unloaded.',locator:'Test paragraph'})-[:FROM_REVISION]->(source)
    CREATE (aspect:SpecSyncReview:ReviewAspect {test_run:$marker,id:$marker})-[:RELATES_TO]->(attribute)
    CREATE (o:SpecSyncReview:ReviewObservation {test_run:$marker,id:$marker,configuration_id:$config,model_id:configuration.model_id,review_status:'ACCEPTED',start_offset:6,end_offset:25,kind:'OPINION',conditions:'unloaded'})-[:ABOUT]->(aspect)
    CREATE (o)-[:SUPPORTED_BY]->(chunk)
    CREATE (rejected:SpecSyncReview:ReviewObservation {test_run:$marker,id:$rejected,configuration_id:$config,model_id:configuration.model_id,review_status:'REJECTED',start_offset:6,end_offset:25,kind:'OPINION'})-[:ABOUT]->(aspect)
    CREATE (rejected)-[:SUPPORTED_BY]->(chunk)
  `,
    { rejected: `${marker}-rejected` },
  );
  await fixture(`
    MATCH (attribute:SpecSyncCatalog:AttributeDefinition {code:'payload'})
    CREATE (:SpecSyncCatalog:ManufacturerTerm {test_run:$marker,id:$marker,term:'Carga útil de teste',brand:'Ford',market:'BR',model:'F-150',model_year:2026})-[:TERM_FOR]->(attribute)
  `);
});
afterAll(async () => {
  try {
    if (fixtureDriver)
      await fixture('MATCH (n {test_run:$marker}) DETACH DELETE n');
  } finally {
    await closeGraph();
    await fixtureDriver?.close();
    vi.unstubAllEnvs();
  }
});
it('requires the evidenced manufacturer, market, model and year for scoped terminology', async () => {
  const scope = {
    q: 'Carga útil de teste',
    brand: 'Ford',
    market: 'BR',
    model: 'F-150',
    modelYear: 2026,
  };
  expect(await retrieveGraph('concepts', scope)).toMatchObject({
    status: 'OK',
    items: [
      {
        code: 'payload',
        manufacturerTerms: [{ term: scope.q, brand: 'Ford' }],
      },
    ],
  });
  expect(
    await retrieveGraph('concepts', { ...scope, model: 'F150' }),
  ).toMatchObject({ status: 'OK', items: [{ code: 'payload' }] });
  for (const override of [
    { brand: 'RAM' },
    { market: 'US' },
    { model: 'Ranger' },
    { modelYear: 2025 },
    { brand: undefined },
    { model: undefined },
    { market: undefined },
    { modelYear: undefined },
  ]) {
    expect(
      await retrieveGraph('concepts', { ...scope, ...override }),
    ).toMatchObject({ status: 'EMPTY', items: [] });
  }
});
it('resolves terminology and accepted optional equipment with package evidence', async () => {
  expect(await retrieveGraph('concepts', { q: 'torque_max' })).toMatchObject({
    status: 'OK',
    items: [{ code: 'torque_max' }],
  });
  const result = await retrieveGraph('capabilities', {
    attributeCode: 'camera_360',
  });
  expect(result.status).toBe('OK');
  const limited = result.items.find(
    (item) => item['configurationId'] === config,
  );
  expect(limited).toMatchObject({ availability: 'OPTIONAL' });
  expect(limited?.['packages']).not.toHaveLength(0);
  expect(limited?.['evidenceIds']).not.toHaveLength(0);
  const standard = await retrieveGraph('capabilities', {
    attributeCode: 'camera_360',
    includeOptional: false,
  });
  expect(
    standard.items.some((item) => item['configurationId'] === config),
  ).toBe(false);
  expect(
    result.items.some(
      (item) =>
        item['configurationId'] === 'c28c64e4-801a-5d29-b4c2-083a888a79f3',
    ),
  ).toBe(false);
});
it('preserves exact excerpts, excludes rejected opinions and isolates configurations', async () => {
  const related = await retrieveGraph('related-reviews', {
    configurationId: config,
    attributeCode: 'rear_suspension',
  });
  expect(related.status).toBe('OK');
  expect(related.items.find((item) => item['id'] === marker)).toMatchObject({
    excerpt: 'firm ride unloaded.',
    scope: 'CONFIGURATION',
    kind: 'OPINION',
  });
  expect(
    related.items.some((item) => item['id'] === `${marker}-rejected`),
  ).toBe(false);
  const other = await retrieveGraph('related-reviews', {
    configurationId: '08e08761-a2e7-5ae5-b2ad-387e93829fb7',
    attributeCode: 'rear_suspension',
  });
  expect(other.items.some((item) => item['id'] === marker)).toBe(false);
  expect(await retrieveGraph('evidence', { q: evidence })).toMatchObject({
    status: 'OK',
    items: [{ excerpt: 'firm ride unloaded.' }],
  });
});
it('searches the real fulltext index and returns stored specification evidence', async () => {
  const search = await retrieveGraph('reviews', {
    q: 'firm',
    configurationId: config,
  });
  expect(search.status).toBe('OK');
  expect(search.items.some((item) => item['id'] === marker)).toBe(true);
  const capabilities = await retrieveGraph('capabilities', {
    attributeCode: 'camera_360',
  });
  const id = (
    capabilities.items[0]?.['evidenceIds'] as string[] | undefined
  )?.[0];
  expect(id).toBeTruthy();
  const excerpt = await retrieveGraph('evidence', { q: id });
  expect(excerpt.status).toBe('OK');
  expect(excerpt.items[0]?.['excerpt']).toBeTruthy();
});
