// Turns the accepted results of a gap-audit run into one data module per
// dataset (tools/catalog/<dataset>/gap-audit-<stamp>.mjs), which the dataset
// manifests merge with merge-audit.mjs. Only reviewed data crosses over:
// fills whose verdict is accepted, the attribute(...) blocks and the alias SQL
// from report.md section 3. Conflicts and editorial holds never do; they are
// listed in the summary for a person to decide.
//
//   node tools/catalog/gap-audit/apply-audit.mjs <outDir> [--hold <slug>:<attribute> ...]
//
// Reads <outDir> and <outDir>/visual (if present). Writes the data modules,
// apps/api/.../V19__gap_audit_terminology.sql and <outDir>/apply-summary.json.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

import fordManifest from '../ford-brasil-2026/manifest.mjs';
import competitorsManifest from '../competitors-brasil-2026/manifest.mjs';

const args = process.argv.slice(2);
const outDir = args[0];
if (!outDir) {
  console.error(
    'Usage: apply-audit.mjs <outDir> [--hold <slug>:<attribute> ...]',
  );
  process.exit(2);
}
const holds = new Set();
for (let i = 1; i < args.length; i++)
  if (args[i] === '--hold') holds.add(args[++i]);

const stamp = outDir.split('/').filter(Boolean).at(-1);
const stampDate = stamp.slice(0, 10);
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

// ---- report section 3: attribute blocks and alias SQL ------------------
const report = readFileSync(join(outDir, 'report.md'), 'utf8');
const section = (from, to) =>
  report.slice(report.indexOf(from), to ? report.indexOf(to) : undefined);
const codeBlocks = (text, lang) =>
  [...text.matchAll(new RegExp('```' + lang + '\\n([\\s\\S]*?)```', 'g'))].map(
    (m) => m[1],
  );
const attributeBlocks = codeBlocks(section('### 3.3 ', '### 3.4 '), 'js').map(
  (block) =>
    vm.runInNewContext(
      `[${block}]`,
      {
        attribute: (code, label, description, valueType, unit = null) => ({
          code,
          label,
          description,
          valueType,
          unit,
        }),
      },
      { timeout: 1000 },
    ),
);
assert.equal(
  attributeBlocks.length,
  2,
  'expected a Ford and a competitors block',
);
const [fordNewAttributes, competitorsNewAttributes] = attributeBlocks;
const [aliasSql] = codeBlocks(section('### 3.4 ', '## 4.'), 'sql');
assert.ok(aliasSql, 'alias SQL block missing from report section 3.4');

// ---- datasets -------------------------------------------------------------
const datasets = {
  'ford-brasil-2026': {
    manifest: fordManifest,
    newAttributes: fordNewAttributes,
    models: (m) => m.models.map((model) => ({ brand: m.brand, model })),
  },
  'competitors-brasil-2026': {
    manifest: competitorsManifest,
    newAttributes: competitorsNewAttributes,
    models: (m) =>
      m.brands.flatMap((brand) =>
        brand.models.map((model) => ({ brand: brand.name, model })),
      ),
  },
};
const datasetOf = (slugDataset) =>
  slugDataset === 'ford-brasil-2026'
    ? 'ford-brasil-2026'
    : 'competitors-brasil-2026';

for (const [name, dataset] of Object.entries(datasets)) {
  const existing = new Set(dataset.manifest.attributes.map((a) => a.code));
  for (const attribute of dataset.newAttributes)
    assert.ok(
      !existing.has(attribute.code),
      `${name}: ${attribute.code} already exists in the manifest`,
    );
  dataset.own = existing;
  dataset.used = new Set();
  dataset.sourcesByUrl = new Map();
  for (const source of dataset.manifest.sources)
    for (const url of source.upstreamUrls)
      dataset.sourcesByUrl.set(normalizeUrl(url), source);
  dataset.cells = new Map();
  for (const { brand, model } of dataset.models(dataset.manifest))
    for (const configuration of model.configurations)
      dataset.cells.set(
        configurationKey(brand, model.name, configuration),
        new Set(configuration.specifications.map((s) => s.attribute)),
      );
  dataset.newSources = new Map();
  dataset.specifications = [];
}
// Cells of one dataset may use attributes the other manifest defines (the
// competitors manifest defines only a few and relies on Ford's definitions in
// the shared catalog), so fills resolve against every known definition and a
// module carries identical copies of the ones its manifest lacks.
// apps/api/data/curated-pickups.json defines a few more (width_unspecified).
const curatedAttributes = readJson(
  'apps/api/data/curated-pickups.json',
).tables.attribute_definition.map((a) => ({
  code: a.code,
  label: a.label,
  description: a.description,
  valueType: a.value_type,
  unit: a.unit ?? null,
}));
const allAttributes = new Map(
  [
    ...curatedAttributes,
    ...fordManifest.attributes,
    ...competitorsManifest.attributes,
    ...fordNewAttributes,
    ...competitorsNewAttributes,
  ].map((a) => [a.code, a]),
);
for (const dataset of Object.values(datasets))
  dataset.attributes = allAttributes;
// A definition that appears in both datasets must be identical: the importer
// upserts by code and checks the stored value type and unit.
for (const attribute of fordNewAttributes) {
  const other = competitorsNewAttributes.find((a) => a.code === attribute.code);
  if (other)
    assert.deepEqual(
      other,
      attribute,
      `diverging definition: ${attribute.code}`,
    );
}

function normalizeUrl(url) {
  return String(url)
    .replace(/[?#].*$/, '')
    .replace(/\/$/, '');
}
function configurationKey(brand, model, configuration) {
  return `${brand}|${model}|${configuration.name}|${configuration.modelYear}`;
}

// ---- fills ----------------------------------------------------------------
const runs = [
  { dir: outDir, label: 'main', capturedOn: stampDate },
  ...(existsSync(join(outDir, 'visual', 'verified'))
    ? [{ dir: join(outDir, 'visual'), label: 'visual', capturedOn: null }]
    : []),
];
const summary = {
  stamp,
  applied: {},
  newSources: {},
  held: [],
  skipped: [],
};
const candidates = new Map();

for (const run of runs) {
  for (const file of readdirSync(join(run.dir, 'verified')).sort()) {
    const slug = file.replace(/\.json$/, '');
    const verified = readJson(join(run.dir, 'verified', file));
    const model = readJson(join(outDir, 'models', `${slug}.json`));
    const dataset = datasets[datasetOf(model.dataset)];
    const configurations = new Map(model.configurations.map((c) => [c.id, c]));
    for (const fill of verified.fills ?? []) {
      if (!fill.verdict?.accepted) continue;
      const item = { run: run.label, slug, fill };
      if (holds.has(`${slug}:${fill.attribute}`)) {
        summary.held.push({ ...describe(item), reason: 'editorial hold' });
        continue;
      }
      const configuration = configurations.get(fill.configurationId);
      if (!configuration) {
        summary.skipped.push({
          ...describe(item),
          reason: 'unknown configuration id',
        });
        continue;
      }
      const key = configurationKey(model.brand, model.model, configuration);
      if (!dataset.cells.has(key)) {
        summary.skipped.push({
          ...describe(item),
          reason: `configuration not in manifest: ${key}`,
        });
        continue;
      }
      if (dataset.cells.get(key).has(fill.attribute)) {
        summary.held.push({
          ...describe(item),
          reason: 'cell already known in the manifest',
        });
        continue;
      }
      const cell = `${key}|${fill.attribute}`;
      candidates.set(cell, [
        ...(candidates.get(cell) ?? []),
        { ...item, run, model, dataset, configuration },
      ]);
    }
  }
}

function describe({ run, slug, fill }) {
  return {
    run: typeof run === 'string' ? run : run.label,
    slug,
    configuration: fill.configurationName,
    attribute: fill.attribute,
    value: fill.value ?? fill.availability,
  };
}

for (const [cell, items] of candidates) {
  const values = new Set(
    items.map((i) => JSON.stringify(i.fill.value ?? i.fill.availability)),
  );
  if (values.size > 1) {
    for (const item of items)
      summary.held.push({
        ...describe(item),
        reason: `accepted fills disagree on this cell (${[...values].join(' vs ')})`,
      });
    continue;
  }
  // Same value from several captures: keep the main run's first one.
  const chosen = items[0];
  const { fill, dataset, model, configuration, run, slug } = chosen;
  const attribute = dataset.attributes.get(fill.attribute);
  if (!attribute) {
    summary.skipped.push({ ...describe(chosen), reason: 'unknown attribute' });
    continue;
  }
  const typeError = checkType(attribute, fill);
  if (typeError) {
    summary.skipped.push({ ...describe(chosen), reason: typeError });
    continue;
  }
  dataset.used.add(fill.attribute);
  const sourceKey = resolveSource(dataset, run, slug, fill.captureKey, model);
  if (!sourceKey) {
    summary.skipped.push({
      ...describe(chosen),
      reason: `capture ${fill.captureKey} has no meta/sha256`,
    });
    continue;
  }
  const specification = {
    attribute: fill.attribute,
    source: sourceKey,
    locator:
      run.label === 'visual'
        ? `${fill.locator ?? 'Official specification table'} (dual visual transcription)`
        : (fill.locator ?? 'Official specification table'),
    excerpt: fill.excerpt,
    rawValue:
      fill.rawValue ??
      `${attribute.label}: ${display(fill.value ?? fill.availability)}`,
    qualifiers: {},
  };
  if (attribute.valueType === 'AVAILABILITY')
    specification.availability = fill.availability;
  else specification.value = fill.value;
  dataset.specifications.push({
    brand: model.brand,
    model: model.model,
    name: configuration.name,
    modelYear: configuration.modelYear,
    specification,
  });
  summary.applied[slug] = (summary.applied[slug] ?? 0) + 1;
}

function display(value) {
  return Array.isArray(value) ? value.join('; ') : String(value);
}

function checkType(attribute, fill) {
  switch (attribute.valueType) {
    case 'AVAILABILITY':
      return ['STANDARD', 'OPTIONAL', 'ABSENT', 'NOT_APPLICABLE'].includes(
        fill.availability,
      ) && fill.value === undefined
        ? null
        : 'availability value invalid';
    case 'LIST':
      return Array.isArray(fill.value) &&
        fill.value.length > 0 &&
        fill.value.every((v) => typeof v === 'string' && v.length > 0)
        ? null
        : 'LIST value must be a non-empty string array';
    case 'NUMBER':
      return typeof fill.value === 'number' && Number.isFinite(fill.value)
        ? null
        : 'NUMBER value must be a finite number';
    default:
      return typeof fill.value === 'string' && fill.value.length > 0
        ? null
        : 'TEXT value must be a non-empty string';
  }
}

function resolveSource(dataset, run, slug, captureKey, model) {
  const metaFile = join(run.dir, 'captures', slug, `${captureKey}.meta.json`);
  if (!existsSync(metaFile)) return null;
  const meta = readJson(metaFile);
  if (!/^[0-9a-f]{64}$/.test(meta.sha256 ?? '')) return null;
  const url = normalizeUrl(meta.url);
  const known = dataset.sourcesByUrl.get(url);
  if (known && known.sha256 === meta.sha256) return known.key;
  const existing = [...dataset.newSources.values()].find(
    (s) => normalizeUrl(s.url) === url && s.sha256 === meta.sha256,
  );
  if (existing) return existing.key;
  // A changed revision of a known source gets its own key, so the specs that
  // already cite the old bytes keep their provenance.
  const base = (known?.key ?? `${slug}_${captureKey}`)
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_');
  const key = known ? `${base}_r${stampDate.replaceAll('-', '')}` : base;
  assert.ok(!dataset.newSources.has(key), `source key collision: ${key}`);
  const capturedOn = (meta.capturedAt ?? stampDate).slice(0, 10);
  const title =
    known?.title ??
    discoverTitle(slug, captureKey) ??
    `${model.brand} ${model.model} — ${captureKey.replaceAll('_', ' ')}`;
  dataset.newSources.set(key, {
    key,
    title,
    url: meta.url,
    sha256: meta.sha256,
    capturedOn,
    revisionOf: known?.key ?? null,
  });
  return key;
}

function discoverTitle(slug, captureKey) {
  const file = join(outDir, 'sources', `${slug}.json`);
  if (!existsSync(file)) return null;
  return (
    readJson(file).sources?.find((s) => s.key === captureKey)?.title ?? null
  );
}

// ---- write the data modules and the migration -----------------------------
for (const [name, dataset] of Object.entries(datasets)) {
  const file = `tools/catalog/${name}/gap-audit-${stampDate}.mjs`;
  const body = {
    stamp,
    sources: [...dataset.newSources.values()],
    attributes: [
      ...dataset.newAttributes,
      ...[...dataset.used]
        .filter(
          (code) =>
            !dataset.own.has(code) &&
            !dataset.newAttributes.some((a) => a.code === code),
        )
        .sort()
        .map((code) => allAttributes.get(code)),
    ],
    specifications: dataset.specifications,
  };
  writeFileSync(
    file,
    `// Generated by tools/catalog/gap-audit/apply-audit.mjs from the gap audit
// ${stamp} (accepted fills, reviewed attribute definitions). Do not edit by
// hand: re-run the generator. Merged into the manifest by merge-audit.mjs.
export default ${JSON.stringify(body, null, 2)};
`,
  );
  summary.newSources[name] = body.sources.length;
  summary[`${name}Specifications`] = body.specifications.length;
  summary[`${name}Attributes`] = body.attributes.length;
}

writeFileSync(
  'apps/api/src/main/resources/db/migration/V19__gap_audit_terminology.sql',
  aliasSql.replace(
    /see tools\/catalog\/gap-audit\/out\/[^)]*\/report\.md/,
    'accepted definitions in tools/catalog/*/gap-audit-*.mjs',
  ),
);
writeFileSync(
  join(outDir, 'apply-summary.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      specifications: Object.fromEntries(
        Object.keys(datasets).map((n) => [n, summary[`${n}Specifications`]]),
      ),
      attributes: Object.fromEntries(
        Object.keys(datasets).map((n) => [n, summary[`${n}Attributes`]]),
      ),
      newSources: summary.newSources,
      held: summary.held.length,
      skipped: summary.skipped.length,
    },
    null,
    2,
  ),
);
