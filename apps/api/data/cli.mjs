import { pathToFileURL } from 'node:url';

import { compose, neo4j, postgres } from './database.mjs';
import {
  loadDataset,
  projectionConstraints,
  projectionStatements,
  seedSql,
  sha256,
  snapshotSql,
} from './foundation.mjs';

export async function migrate() {
  await compose(['run', '--rm', 'migrate'], { inherit: true });
}

export async function seed() {
  const { dataset, digest } = await loadDataset();
  await postgres(seedSql(dataset, digest));
  console.log(
    `Seed ready: ${dataset.version} (${dataset.tables.vehicle_configuration.length} configurations).`,
  );
}

export async function project() {
  const snapshot = JSON.parse(await postgres(snapshotSql()));
  if (!snapshot.seed_dataset.length || !snapshot.vehicle_configuration.length) {
    throw new Error(
      'Catalog is not seeded. Run api:data-seed before projecting.',
    );
  }
  const fingerprint = sha256(JSON.stringify(snapshot));
  // Schema commands are separate from data writes. The actual replacement is one transaction.
  for (const statement of projectionConstraints) await neo4j([statement]);
  await neo4j(projectionStatements(snapshot, fingerprint));
  const after = sha256(
    JSON.stringify(JSON.parse(await postgres(snapshotSql()))),
  );
  if (after !== fingerprint) {
    throw new Error(
      'PostgreSQL changed during projection. The graph contains a consistent older snapshot; rerun api:data-project.',
    );
  }
  console.log(
    `Graph ready: ${snapshot.vehicle_configuration.length} configurations, fingerprint ${fingerprint}.`,
  );
}

export async function status() {
  const snapshot = JSON.parse(await postgres(snapshotSql()));
  const fingerprint = sha256(JSON.stringify(snapshot));
  const graph = await neo4j([
    {
      statement: `MATCH (p:SpecSyncCatalog:CatalogProjection {id: 'catalog'})
      RETURN p.fingerprint, p.seed_versions, toString(p.projected_at)`,
    },
  ]);
  const projection = graph[0].data[0]?.row;
  const [postgresPort, browserPort, boltPort] = await Promise.all([
    compose(['port', 'postgres', '5432']),
    compose(['port', 'neo4j', '7474']),
    compose(['port', 'neo4j', '7687']),
  ]);
  console.log(
    JSON.stringify(
      {
        configurations: snapshot.vehicle_configuration.length,
        attributes: snapshot.attribute_definition.length,
        assertions: snapshot.spec_assertion.length,
        knowledgeStates: snapshot.accepted_specification.reduce(
          (counts, cell) => {
            counts[cell.knowledge_status] =
              (counts[cell.knowledge_status] ?? 0) + 1;
            return counts;
          },
          {},
        ),
        seedVersions: snapshot.seed_dataset.map((row) => row.version),
        postgresFingerprint: fingerprint,
        graphFingerprint: projection?.[0] ?? null,
        projectionCurrent: projection?.[0] === fingerprint,
        postgres: postgresPort,
        neo4jBrowser: `http://${browserPort}`,
        neo4jBolt: `bolt://${boltPort}`,
      },
      null,
      2,
    ),
  );
}

async function main(command) {
  switch (command) {
    case 'up':
      // Validate fixtures before starting services or writing data.
      await loadDataset();
      await compose(['up', '-d', '--wait', 'postgres', 'neo4j'], {
        inherit: true,
      });
      await migrate();
      await seed();
      await project();
      await status();
      break;
    case 'migrate':
      await migrate();
      break;
    case 'seed':
      await seed();
      break;
    case 'project':
      await project();
      break;
    case 'status':
      await status();
      break;
    default:
      throw new Error(
        'Usage: node apps/api/data/cli.mjs <up|migrate|seed|project|status>',
      );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv[2]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
