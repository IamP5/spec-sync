import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Generates the AI credits rate card from OpenRouter's public model catalog.
//
//   node scripts/credits/openrouter-tariffs.mjs            # refresh the snapshot
//   node scripts/credits/openrouter-tariffs.mjs --sql      # print every migration's rows
//   node scripts/credits/openrouter-tariffs.mjs --sql V15  # one migration's rows
//
// The snapshot (`openrouter-tariffs.json`) is committed next to this file and is
// the single source the migration rows are generated from: prices are never
// typed by hand and never invented. `--sql` reads the snapshot, so the rows in
// every seeding migration can be regenerated offline and diffed against what
// is committed.
//
// See docs/openrouter-model-routing.md, "Rate card".

const here = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = path.join(here, 'openrouter-tariffs.json');

const CATALOG_URL = 'https://openrouter.ai/api/v1/models';

// Every model a seeding migration priced, with the migration that seeded it.
// Order is the order of the migration rows. A model stays here after its tariff
// is deactivated: the ledger points at the row, and the snapshot test checks
// that each migration still contains the rows it was generated with.
export const SEEDS = [
  { id: 'google/gemini-3.5-flash-lite', migration: 'V8' },
  { id: 'google/gemini-3.8-flash', migration: 'V8' },
  { id: 'google/gemini-3.1-pro-preview', migration: 'V8' },
  { id: 'anthropic/claude-sonnet-5', migration: 'V8' },
  { id: 'openai/gpt-5.6-luna', migration: 'V15' },
  { id: 'openai/gpt-5.6-sol', migration: 'V15' },
];

export const SEEDED_MODELS = SEEDS.map((seed) => seed.id);

// Stable, hand-assigned tariff ids: the ledger points at a tariff version, so a
// regenerated seed must keep naming the same rows.
const TARIFF_IDS = {
  'google/gemini-3.5-flash-lite': '7c1b1a10-0001-4000-8000-000000000001',
  'google/gemini-3.8-flash': '7c1b1a10-0001-4000-8000-000000000006',
  'google/gemini-3.1-pro-preview': '7c1b1a10-0001-4000-8000-000000000003',
  'anthropic/claude-sonnet-5': '7c1b1a10-0001-4000-8000-000000000004',
  'openai/gpt-5.6-luna': '7c1b1a10-0001-4000-8000-000000000007',
  'openai/gpt-5.6-sol': '7c1b1a10-0001-4000-8000-000000000008',
};

// Google Search grounding runs on Vertex AI directly and is billed by Google
// under the bare model id, so the two Gemini generations the Balanced and Deep
// tiers ground with need their own `vertex` tariff rows. Google publishes the
// same list price on Vertex and through OpenRouter, so the rows mirror the
// OpenRouter catalog entry of the same model. Version 2: V7 seeded version 1 of
// both and V8 deactivated them.
export const VERTEX_MIRRORS = [
  {
    id: '7c1b1a10-0001-4000-8000-000000000009',
    modelId: 'gemini-3.8-flash',
    source: 'google/gemini-3.8-flash',
    version: 2,
    migration: 'V15',
  },
  {
    id: '7c1b1a10-0001-4000-8000-00000000000a',
    modelId: 'gemini-3.1-pro-preview',
    source: 'google/gemini-3.1-pro-preview',
    version: 2,
    migration: 'V15',
  },
];

// Path of each seeding migration, relative to this file.
export const MIGRATIONS = {
  V8: '../../apps/api/src/main/resources/db/migration/V8__openrouter_credits.sql',
  V15: '../../apps/api/src/main/resources/db/migration/V15__tier_tariffs.sql',
};

// micro_credits_per_million = round_half_up(usd_per_token x 1e6 x 100 x 1e6),
// which is usd_per_token x 1e14. 1 credit is USD 0.01 and 1 credit is 1e6
// micro-credits.
const MICRO_CREDITS_PER_USD_TOKEN_EXPONENT = 14;

// A model whose catalog entry publishes no cache-read price is charged for
// cached input at a quarter of its input price, the convention of the previous
// rate card.
const CACHE_READ_FALLBACK_NUMERATOR = 1n;
const CACHE_READ_FALLBACK_DENOMINATOR = 4n;

/**
 * Scales a decimal string by 10^exponent, exactly, rounding half up. The USD
 * prices arrive as strings such as "0.0000000833333333333333"; parsing them as
 * doubles would round before the scaling and is not allowed to decide a price.
 */
export function scaleDecimal(value, exponent) {
  const text = String(value).trim();
  if (!/^-?\d*(\.\d*)?$/.test(text) || text === '' || text === '-') {
    throw new Error(`Not a decimal price: ${value}`);
  }
  const negative = text.startsWith('-');
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const digits = `${whole || '0'}${fraction}`;
  const shift = exponent - fraction.length;
  let scaled;
  if (shift >= 0) {
    scaled = BigInt(digits) * 10n ** BigInt(shift);
  } else {
    // Round half up on the digits the scaling drops.
    const divisor = 10n ** BigInt(-shift);
    const quotient = BigInt(digits) / divisor;
    const remainder = BigInt(digits) % divisor;
    scaled = remainder * 2n >= divisor ? quotient + 1n : quotient;
  }
  return negative ? -scaled : scaled;
}

/** micro-credits per million tokens for one USD-per-token price string. */
function microCreditsPerMillion(usdPerToken) {
  return scaleDecimal(usdPerToken, MICRO_CREDITS_PER_USD_TOKEN_EXPONENT);
}

/**
 * The three prices of one catalog entry. `input_cache_read` is optional; the
 * fallback is a quarter of input, applied to the already-scaled integer so the
 * whole computation stays in integer arithmetic.
 */
export function tariffFor(model) {
  const pricing = model?.pricing ?? {};
  if (!pricing.prompt || !pricing.completion) {
    throw new Error(`${model?.id} publishes no prompt/completion price`);
  }
  const inputPerMillion = microCreditsPerMillion(pricing.prompt);
  const outputPerMillion = microCreditsPerMillion(pricing.completion);
  const cachedPublished = pricing.input_cache_read;
  const cachedInputPerMillion = cachedPublished
    ? microCreditsPerMillion(cachedPublished)
    : ceilDiv(
        inputPerMillion * CACHE_READ_FALLBACK_NUMERATOR,
        CACHE_READ_FALLBACK_DENOMINATOR,
      );
  return {
    provider: 'openrouter',
    modelId: model.id,
    version: 1,
    inputPerMillion: inputPerMillion.toString(),
    cachedInputPerMillion: cachedInputPerMillion.toString(),
    outputPerMillion: outputPerMillion.toString(),
    cacheReadPublished: Boolean(cachedPublished),
    usd: {
      prompt: String(pricing.prompt),
      completion: String(pricing.completion),
      inputCacheRead: cachedPublished ? String(cachedPublished) : null,
    },
  };
}

function ceilDiv(numerator, denominator) {
  return (numerator + denominator - 1n) / denominator;
}

async function fetchCatalog() {
  const response = await fetch(CATALOG_URL, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`${CATALOG_URL} answered ${response.status}`);
  }
  const body = await response.json();
  if (!Array.isArray(body?.data)) {
    throw new Error(`${CATALOG_URL} returned no model list`);
  }
  return body.data;
}

async function refresh() {
  const catalog = await fetchCatalog();
  const models = SEEDS.map(({ id, migration }) => {
    const entry = catalog.find((model) => model.id === id);
    if (!entry) {
      throw new Error(
        `OpenRouter does not list ${id}; the tier table needs a decision, not a guess`,
      );
    }
    return { id: TARIFF_IDS[id], migration, ...tariffFor(entry) };
  });
  const snapshot = {
    source: CATALOG_URL,
    fetchedAt: new Date().toISOString(),
    unit: 'micro-credits per million tokens (1 credit = 1_000_000 micro-credits = USD 0.01)',
    conversion: 'round_half_up(usd_per_token * 1e6 * 100 * 1e6)',
    cacheReadFallback:
      '25% of input when OpenRouter publishes no input_cache_read',
    models,
  };
  await writeFile(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return snapshot;
}

async function readSnapshot() {
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(SNAPSHOT, 'utf8'));
}

function row(id, provider, modelId, version, prices) {
  return (
    `    ('${id}', '${provider}', '${modelId}', ${version}, ` +
    `${prices.inputPerMillion}, ${prices.cachedInputPerMillion}, ${prices.outputPerMillion}, true)`
  );
}

/**
 * The VALUES rows of one seeding migration (every migration when `migration`
 * is omitted): the OpenRouter rows in the order of SEEDS, then the Vertex
 * mirrors that migration adds. A model seeded by V8 keeps its migration even
 * though V15 deactivates it, so the V8 test keeps guarding V8's rows.
 */
export function sqlRows(snapshot, migration) {
  const rows = snapshot.models
    .filter((model) => !migration || model.migration === migration)
    .map((model) =>
      row(model.id, 'openrouter', model.modelId, model.version, model),
    );
  for (const mirror of VERTEX_MIRRORS) {
    if (migration && mirror.migration !== migration) continue;
    const source = snapshot.models.find(
      (model) => model.modelId === mirror.source,
    );
    if (!source) {
      throw new Error(`${mirror.source} is not in the snapshot`);
    }
    rows.push(row(mirror.id, 'vertex', mirror.modelId, mirror.version, source));
  }
  return rows.join(',\n');
}

const [, entry] = process.argv;
if (entry && path.resolve(entry) === fileURLToPath(import.meta.url)) {
  const sql = process.argv.indexOf('--sql');
  if (sql !== -1) {
    const snapshot = await readSnapshot();
    const migration = process.argv[sql + 1];
    console.log(
      `-- generated from openrouter-tariffs.json, fetched ${snapshot.fetchedAt}`,
    );
    console.log(sqlRows(snapshot, migration));
  } else {
    const snapshot = await refresh();
    console.log(
      `[openrouter-tariffs] ${snapshot.models.length} models, fetched ${snapshot.fetchedAt}`,
    );
    console.log(sqlRows(snapshot));
  }
}
