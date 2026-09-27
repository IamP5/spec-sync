// Deterministic reconciliation of two independent visual transcriptions of
// one image-only source (a scanned ficha técnica, a dimensions diagram). Only
// the cells both transcribers read identically become capture text, so a
// value one model misread or invented cannot reach the analysis stage.
//
//   node tools/catalog/gap-audit/reconcile-transcripts.mjs <visualDir> <slug> <key> <capturedAt> [--label-prefix]
//
// --label-prefix matches labels on the text before " – " only, for diagrams
// whose rows are letter codes ("A (sem antena) – altura total"): the value
// must still agree, but the meaning after the dash comes from transcriber A
// and is left to the refuter.
//
// Reads <visualDir>/transcripts/<slug>/<key>.a.json and <key>.b.json:
//   { key, url, kind, method, sha256, bytes,
//     rows: [{ page, section, label, column, value }] }
// Writes <visualDir>/captures/<slug>/<key>.txt, <key>.meta.json and
// <key>.disagreements.json, and prints the agreement summary as JSON.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [visualDir, slug, key, capturedAt, flag] = process.argv.slice(2);
const labelPrefix = flag === '--label-prefix';
if (!visualDir || !slug || !key || !capturedAt) {
  console.error(
    'Usage: reconcile-transcripts.mjs <visualDir> <slug> <key> <capturedAt> [--label-prefix]',
  );
  process.exit(2);
}

const transcriptPath = (side) =>
  join(visualDir, 'transcripts', slug, `${key}.${side}.json`);
const missing = ['a', 'b'].filter((side) => !existsSync(transcriptPath(side)));
if (missing.length) {
  console.log(
    JSON.stringify({ slug, key, error: `missing transcript(s): ${missing}` }),
  );
  process.exit(0);
}
const a = JSON.parse(readFileSync(transcriptPath('a'), 'utf8'));
const b = JSON.parse(readFileSync(transcriptPath('b'), 'utf8'));

const norm = (text) =>
  String(text ?? '')
    .normalize('NFKC')
    .replace(/[“”″]/g, '"')
    .replace(/[‘’′]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
// Labels and headers may differ in punctuation or spacing between readers;
// values may not.
const loose = (text) => norm(text).replace(/[^\p{L}\p{N}]+/gu, '');

const cells = (t) =>
  (t.rows ?? []).filter((r) => r && norm(r.label) && norm(r.value));
const labelOf = (r) =>
  loose(labelPrefix ? String(r.label ?? '').split(/\s[–-]\s/)[0] : r.label);
const fullKey = (r) =>
  [loose(r.section), labelOf(r), loose(r.column)].join('|');
const shortKey = (r) => [labelOf(r), loose(r.column)].join('|');

function index(rows, keyOf) {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return map;
}

const rowsA = cells(a);
const rowsB = cells(b);
const byFullB = index(rowsB, fullKey);
const byShortA = index(rowsA, shortKey);
const byShortB = index(rowsB, shortKey);
const usedB = new Set();
const agreed = [];
const disagreements = [];

for (const r of rowsA) {
  // Section names are the least stable part of a transcription, so fall back
  // to label + column when that pair is unique on both sides.
  let candidates = (byFullB.get(fullKey(r)) ?? []).filter((x) => !usedB.has(x));
  if (
    !candidates.length &&
    byShortA.get(shortKey(r))?.length === 1 &&
    byShortB.get(shortKey(r))?.length === 1
  )
    candidates = byShortB.get(shortKey(r)).filter((x) => !usedB.has(x));
  const match = candidates.find((x) => norm(x.value) === norm(r.value));
  if (match) {
    usedB.add(match);
    agreed.push(r);
  } else if (candidates.length) {
    usedB.add(candidates[0]);
    disagreements.push({ kind: 'value', a: r, b: candidates[0] });
  } else disagreements.push({ kind: 'only-a', a: r });
}
for (const r of rowsB)
  if (!usedB.has(r)) disagreements.push({ kind: 'only-b', b: r });

const line = (r) =>
  `[p${r.page ?? '?'}] ${[r.section, r.label].filter((x) => norm(x)).join(' › ')}` +
  `${norm(r.column) ? ` | ${r.column}` : ''}: ${r.value}`;
const text = [
  `# Visual transcription of ${a.url ?? key}`,
  '# Only cells read identically by two independent transcribers are listed.',
  ...agreed.map(line),
].join('\n');

const captureDir = join(visualDir, 'captures', slug);
mkdirSync(captureDir, { recursive: true });
writeFileSync(join(captureDir, `${key}.txt`), `${text}\n`);
const sameSource =
  !a.sha256 || !b.sha256 || a.sha256 === b.sha256 ? true : false;
const meta = {
  key,
  url: a.url ?? b.url,
  kind: a.kind ?? b.kind ?? 'pdf',
  method: `visual-dual (${a.method ?? 'a'} / ${b.method ?? 'b'})`,
  sha256: a.sha256 ?? b.sha256 ?? null,
  bytes: a.bytes ?? b.bytes ?? null,
  capturedAt,
  labelMatching: labelPrefix
    ? 'prefix before dash (meaning from A)'
    : 'full label',
  sameSourceBytes: sameSource,
  agreement: {
    agreed: agreed.length,
    cellsA: rowsA.length,
    cellsB: rowsB.length,
    ratio:
      rowsA.length + rowsB.length
        ? +((2 * agreed.length) / (rowsA.length + rowsB.length)).toFixed(3)
        : 0,
  },
};
writeFileSync(
  join(captureDir, `${key}.meta.json`),
  `${JSON.stringify(meta, null, 2)}\n`,
);
writeFileSync(
  join(captureDir, `${key}.disagreements.json`),
  `${JSON.stringify(disagreements, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    slug,
    key,
    ...meta.agreement,
    disagreements: disagreements.length,
    sameSourceBytes: sameSource,
  }),
);
