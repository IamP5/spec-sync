// Deterministic validation of one model's gap-audit findings against the
// captured source text and the exported ontology. LLM stages propose; this
// script proves that every excerpt exists verbatim in a capture, that every
// attribute code exists, that values match the attribute's value type and that
// a "fill" really targets a cell the catalog does not know yet.
//
//   node tools/catalog/gap-audit/verify-findings.mjs <outDir> <slug>
//
// Reads <outDir>/findings/<slug>.json, writes <outDir>/verified/<slug>.json
// and prints the summary as JSON. Exit code 0 even when items fail; the
// per-item `checks` array is the verdict.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [outDir, slug] = process.argv.slice(2);
if (!outDir || !slug) {
  console.error('Usage: verify-findings.mjs <outDir> <slug>');
  process.exit(2);
}
const findingsPath = join(outDir, 'findings', `${slug}.json`);
if (!existsSync(findingsPath)) {
  console.log(
    JSON.stringify({
      slug,
      error: 'findings file missing',
      path: findingsPath,
    }),
  );
  process.exit(0);
}
const findings = JSON.parse(readFileSync(findingsPath, 'utf8'));
const model = JSON.parse(
  readFileSync(join(outDir, 'models', `${slug}.json`), 'utf8'),
);
const ontology = JSON.parse(
  readFileSync(join(outDir, 'ontology.json'), 'utf8'),
);
const attributes = new Map(ontology.attributes.map((a) => [a.code, a]));
const aliasIndex = new Map();
for (const a of ontology.attributes) {
  aliasIndex.set(normalize(a.label), a.code);
  aliasIndex.set(normalize(a.code.replaceAll('_', ' ')), a.code);
  for (const alias of a.aliases) aliasIndex.set(normalize(alias), a.code);
}
const configurations = new Map(model.configurations.map((c) => [c.id, c]));

function normalize(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/[“”″]/g, '"')
    .replace(/[‘’′]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const captureText = new Map();
const captureChecks = [];
for (const capture of findings.captures ?? []) {
  const file = join(outDir, 'captures', slug, `${capture.key}.txt`);
  const ok = existsSync(file) && readFileSync(file, 'utf8').trim().length > 0;
  captureChecks.push({ key: capture.key, url: capture.url, ok, file });
  if (ok) captureText.set(capture.key, normalize(readFileSync(file, 'utf8')));
}

function excerptCheck(item) {
  const excerpt = normalize(item.excerpt);
  if (excerpt.length < 8)
    return {
      name: 'excerpt',
      ok: false,
      reason: 'excerpt shorter than 8 characters',
    };
  const text = captureText.get(item.captureKey);
  if (!text)
    return {
      name: 'excerpt',
      ok: false,
      reason: `capture ${item.captureKey} missing`,
    };
  return text.includes(excerpt)
    ? { name: 'excerpt', ok: true }
    : {
        name: 'excerpt',
        ok: false,
        reason: 'excerpt not found verbatim in capture text',
      };
}

function valueTypeCheck(attribute, item) {
  if (!attribute)
    return { name: 'valueType', ok: false, reason: 'unknown attribute' };
  switch (attribute.valueType) {
    case 'NUMBER':
      return typeof item.value === 'number' && Number.isFinite(item.value)
        ? { name: 'valueType', ok: true }
        : {
            name: 'valueType',
            ok: false,
            reason: 'NUMBER attribute needs a finite numeric value',
          };
    case 'LIST':
      return Array.isArray(item.value) &&
        item.value.length > 0 &&
        item.value.every((v) => typeof v === 'string' && v.trim())
        ? { name: 'valueType', ok: true }
        : {
            name: 'valueType',
            ok: false,
            reason: 'LIST attribute needs a non-empty array of strings',
          };
    case 'AVAILABILITY':
      return ['STANDARD', 'OPTIONAL', 'ABSENT', 'NOT_APPLICABLE'].includes(
        item.availability,
      )
        ? { name: 'valueType', ok: true }
        : {
            name: 'valueType',
            ok: false,
            reason:
              'AVAILABILITY needs STANDARD|OPTIONAL|ABSENT|NOT_APPLICABLE',
          };
    default:
      return typeof item.value === 'string' && item.value.trim()
        ? { name: 'valueType', ok: true }
        : {
            name: 'valueType',
            ok: false,
            reason: 'TEXT attribute needs a non-empty string',
          };
  }
}

function vocabularyCheck(attribute, item) {
  if (
    !attribute ||
    attribute.valueType !== 'LIST' ||
    !attribute.vocabulary?.length
  )
    return { name: 'vocabulary', ok: true };
  const allowed = new Set(attribute.vocabulary.map((v) => v.code));
  const bad = (item.value ?? []).filter((v) => !allowed.has(v));
  return bad.length
    ? {
        name: 'vocabulary',
        ok: false,
        reason: `values outside controlled vocabulary: ${bad.join(', ')}`,
      }
    : { name: 'vocabulary', ok: true };
}

const fills = (findings.fills ?? []).map((item) => {
  const attribute = attributes.get(item.attribute);
  const configuration = configurations.get(item.configurationId);
  const current = configuration?.specifications?.[item.attribute];
  const checks = [
    {
      name: 'attribute',
      ok: Boolean(attribute),
      reason: attribute
        ? undefined
        : `attribute ${item.attribute} does not exist; propose it as a concept instead`,
    },
    {
      name: 'configuration',
      ok: Boolean(configuration),
      reason: configuration ? undefined : 'configuration id not in this model',
    },
    {
      name: 'cellUnknown',
      ok: current ? current.status !== 'KNOWN' : false,
      reason:
        current?.status === 'KNOWN'
          ? 'catalog already knows this cell; report as conflict if the value differs'
          : current
            ? undefined
            : 'no cell for this attribute',
    },
    excerptCheck(item),
    valueTypeCheck(attribute, item),
    vocabularyCheck(attribute, item),
  ];
  return { ...item, ok: checks.every((c) => c.ok), checks };
});

const conflicts = (findings.conflicts ?? []).map((item) => {
  const attribute = attributes.get(item.attribute);
  const configuration = configurations.get(item.configurationId);
  const current = configuration?.specifications?.[item.attribute];
  const checks = [
    { name: 'attribute', ok: Boolean(attribute) },
    { name: 'configuration', ok: Boolean(configuration) },
    {
      name: 'cellKnown',
      ok: current?.status === 'KNOWN',
      reason:
        current?.status === 'KNOWN'
          ? undefined
          : 'catalog cell is not KNOWN; this is a fill, not a conflict',
    },
    {
      name: 'catalogValue',
      ok: current
        ? JSON.stringify(current.value ?? current.availability) ===
          JSON.stringify(item.catalogValue)
        : false,
      reason: 'catalogValue must equal the exported cell value',
    },
    excerptCheck(item),
  ];
  return { ...item, ok: checks.every((c) => c.ok), checks };
});

const concepts = (findings.concepts ?? []).map((item) => {
  const code = String(item.suggestedCode ?? '');
  const existingByCode = attributes.get(code);
  const existingByTerm = aliasIndex.get(normalize(item.term));
  const checks = [
    {
      name: 'codeShape',
      ok: /^[a-z][a-z0-9_]*$/.test(code),
      reason: 'suggestedCode must match ^[a-z][a-z0-9_]*$',
    },
    {
      name: 'codeNew',
      ok: !existingByCode,
      reason: existingByCode
        ? `code already exists (${code}); this is a fill, not a concept`
        : undefined,
    },
    {
      name: 'termNew',
      ok: !existingByTerm,
      reason: existingByTerm
        ? `term already maps to ${existingByTerm} via label/alias`
        : undefined,
    },
    {
      name: 'valueTypeShape',
      ok: ['NUMBER', 'TEXT', 'LIST', 'AVAILABILITY'].includes(
        item.suggestedValueType,
      ),
      reason: 'suggestedValueType must be NUMBER|TEXT|LIST|AVAILABILITY',
    },
    {
      name: 'unitShape',
      ok: item.suggestedUnit == null || item.suggestedValueType === 'NUMBER',
      reason: 'only NUMBER attributes carry a unit',
    },
    excerptCheck(item),
  ];
  return { ...item, ok: checks.every((c) => c.ok), checks };
});

const summary = {
  slug,
  captures: {
    total: captureChecks.length,
    ok: captureChecks.filter((c) => c.ok).length,
  },
  fills: { total: fills.length, ok: fills.filter((f) => f.ok).length },
  conflicts: {
    total: conflicts.length,
    ok: conflicts.filter((f) => f.ok).length,
  },
  concepts: { total: concepts.length, ok: concepts.filter((f) => f.ok).length },
};
const verified = {
  ...findings,
  captureChecks,
  fills,
  conflicts,
  concepts,
  deterministic: summary,
};
writeFileSync(
  join(outDir, 'verified', `${slug}.json`),
  JSON.stringify(verified, null, 2),
);
console.log(JSON.stringify(summary));
