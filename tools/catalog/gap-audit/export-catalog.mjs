// Exports the active catalog (configurations, accepted specifications, known
// official sources) and the ontology from the local Compose PostgreSQL into
// JSON files that the catalog-gap-audit workflow agents read.
//
//   node tools/catalog/gap-audit/export-catalog.mjs <outDir> [--models "Ford/Territory,Toyota/Hilux"]
//
// Writes <outDir>/ontology.json, <outDir>/models.json and <outDir>/models/<slug>.json.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [outDir, ...rest] = process.argv.slice(2);
if (!outDir) {
  console.error(
    'Usage: export-catalog.mjs <outDir> [--models "Brand/Model,..."]',
  );
  process.exit(2);
}
const modelsFlag = rest.indexOf('--models');
const only =
  modelsFlag >= 0 && rest[modelsFlag + 1]
    ? new Set(rest[modelsFlag + 1].split(',').map((s) => s.trim()))
    : null;

function psql(sql) {
  const result = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'myuser',
      '-d',
      'mydatabase',
    ],
    { input: sql, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 },
  );
  if (result.status !== 0)
    throw new Error(
      `psql exited ${result.status}: ${result.stderr}${result.stdout.slice(0, 500)}`,
    );
  return result.stdout.trim();
}

export const slugify = (brand, model) =>
  `${brand}-${model}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const ontology = JSON.parse(
  psql(`SELECT jsonb_build_object(
    'attributes', (SELECT jsonb_agg(jsonb_build_object(
        'code', d.code, 'label', d.label, 'description', d.description,
        'valueType', d.value_type, 'unit', d.unit,
        'aliases', (SELECT coalesce(jsonb_agg(a.term ORDER BY a.term), '[]'::jsonb) FROM catalog.attribute_alias a WHERE a.attribute_id = d.id),
        'vocabulary', (SELECT coalesce(jsonb_agg(jsonb_build_object('code', v.code, 'aliases', v.aliases) ORDER BY v.code), '[]'::jsonb) FROM catalog.attribute_value v WHERE v.attribute_id = d.id)
      ) ORDER BY d.code) FROM catalog.attribute_definition d),
    'manufacturerTerms', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'attribute', d.code, 'term', t.term, 'brand', t.brand, 'market', t.market, 'model', t.model, 'modelYear', t.model_year
      ) ORDER BY d.code, t.term), '[]'::jsonb) FROM catalog.manufacturer_term t JOIN catalog.attribute_definition d ON d.id = t.attribute_id),
    'openProposals', (SELECT coalesce(jsonb_agg(to_jsonb(p) - 'id'), '[]'::jsonb) FROM catalog.ontology_proposal p)
  )::text;`),
);

const rows = psql(`SELECT jsonb_build_object(
    'brand', b.name, 'model', m.name,
    'configurations', (SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'market', c.market, 'modelYear', c.model_year,
        'identityStatus', c.identity_status,
        'identitySource', (SELECT r.upstream_urls->>0 FROM catalog.evidence e JOIN catalog.source_revision r ON r.id = e.source_revision_id WHERE e.id = c.identity_evidence_id),
        'specifications', (SELECT jsonb_object_agg(x.attribute_code, jsonb_build_object(
            'status', x.knowledge_status, 'value', x.value, 'availability', x.availability,
            'rawValue', (SELECT s.raw_value FROM catalog.spec_assertion s WHERE s.id = x.assertion_id)
          )) FROM catalog.specification_matrix x WHERE x.configuration_id = c.id)
      ) ORDER BY c.model_year, c.name) FROM catalog.vehicle_configuration c WHERE c.model_id = m.id AND c.superseded_by IS NULL),
    'knownSources', (SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object(
        'id', r.id, 'title', r.title, 'path', r.path, 'sha256', r.sha256,
        'upstreamUrls', r.upstream_urls, 'capturedOn', r.captured_on, 'provenance', r.provenance
      )), '[]'::jsonb)
      FROM catalog.source_revision r WHERE r.id IN (
        SELECT e.source_revision_id FROM catalog.vehicle_configuration c
          JOIN catalog.evidence e ON e.id = c.identity_evidence_id WHERE c.model_id = m.id AND c.superseded_by IS NULL
        UNION SELECT e.source_revision_id FROM catalog.vehicle_configuration c
          JOIN catalog.spec_assertion s ON s.configuration_id = c.id
          JOIN catalog.assertion_evidence ae ON ae.assertion_id = s.id
          JOIN catalog.evidence e ON e.id = ae.evidence_id WHERE c.model_id = m.id AND c.superseded_by IS NULL))
  )::text
  FROM catalog.vehicle_model m JOIN catalog.brand b ON b.id = m.brand_id
  WHERE EXISTS (SELECT 1 FROM catalog.vehicle_configuration c WHERE c.model_id = m.id AND c.superseded_by IS NULL)
  ORDER BY b.name, m.name;`)
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));

mkdirSync(join(outDir, 'models'), { recursive: true });
for (const dir of ['captures', 'findings', 'verified'])
  mkdirSync(join(outDir, dir), { recursive: true });
writeFileSync(join(outDir, 'ontology.json'), JSON.stringify(ontology, null, 2));

const index = [];
for (const row of rows) {
  const key = `${row.brand}/${row.model}`;
  if (only && !only.has(key)) continue;
  const slug = slugify(row.brand, row.model);
  const dataset =
    row.brand === 'Ford' ? 'ford-brasil-2026' : 'competitors-brasil-2026';
  const doc = { slug, dataset, ...row };
  writeFileSync(
    join(outDir, 'models', `${slug}.json`),
    JSON.stringify(doc, null, 2),
  );
  index.push({
    slug,
    brand: row.brand,
    model: row.model,
    dataset,
    configurationCount: row.configurations.length,
    knownSourceCount: row.knownSources.length,
    notReportedCells: row.configurations.reduce(
      (n, c) =>
        n +
        Object.values(c.specifications ?? {}).filter(
          (s) => s.status !== 'KNOWN',
        ).length,
      0,
    ),
    file: `${outDir}/models/${slug}.json`,
  });
}
if (only) {
  const missing = [...only].filter(
    (k) => !index.some((i) => `${i.brand}/${i.model}` === k),
  );
  if (missing.length) console.error(`Not in catalog: ${missing.join(', ')}`);
}
writeFileSync(
  join(outDir, 'models.json'),
  JSON.stringify(
    { outDir, attributeCount: ontology.attributes.length, models: index },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    outDir,
    attributeCount: ontology.attributes.length,
    models: index,
  }),
);
