import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  MIGRATIONS,
  SEEDED_MODELS,
  scaleDecimal,
  sqlRows,
  tariffFor,
} from './openrouter-tariffs.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('scaleDecimal', () => {
  it('scales a price string exactly, without ever going through a double', () => {
    // 0.0000015 USD per token is 150_000_000 micro-credits per million tokens.
    expect(scaleDecimal('0.0000015', 14)).toBe(150000000n);
    expect(scaleDecimal('0.00001', 14)).toBe(1000000000n);
    // A repeating price the catalog truncates: the dropped digits must not shift the result.
    expect(scaleDecimal('0.0000000833333333333333', 14)).toBe(8333333n);
  });

  it('rounds half up on the digits the scaling drops', () => {
    expect(scaleDecimal('0.000000000000005', 14)).toBe(1n);
    expect(scaleDecimal('0.0000000000000049', 14)).toBe(0n);
  });

  it('refuses anything that is not a decimal', () => {
    expect(() => scaleDecimal('1e-6', 14)).toThrow(/decimal/);
  });
});

describe('tariffFor', () => {
  it('reads the three published prices', () => {
    const tariff = tariffFor({
      id: 'google/gemini-3.5-flash',
      pricing: {
        prompt: '0.0000015',
        completion: '0.000009',
        input_cache_read: '0.00000015',
      },
    });
    expect(tariff).toMatchObject({
      provider: 'openrouter',
      modelId: 'google/gemini-3.5-flash',
      inputPerMillion: '150000000',
      cachedInputPerMillion: '15000000',
      outputPerMillion: '900000000',
      cacheReadPublished: true,
    });
  });

  it('falls back to 25% of input when no cache-read price is published', () => {
    const tariff = tariffFor({
      id: 'x/y',
      pricing: { prompt: '0.0000015', completion: '0.000009' },
    });
    expect(tariff.cachedInputPerMillion).toBe('37500000');
    expect(tariff.cacheReadPublished).toBe(false);
  });

  it('refuses a model the catalog does not price', () => {
    expect(() => tariffFor({ id: 'x/y', pricing: {} })).toThrow(/price/);
  });
});

describe('the committed snapshot', () => {
  it('prices exactly the seeded models and feeds every seeding migration', async () => {
    const snapshot = JSON.parse(
      await readFile(path.join(here, 'openrouter-tariffs.json'), 'utf8'),
    );
    expect(snapshot.models.map((model) => model.modelId)).toEqual(
      SEEDED_MODELS,
    );
    expect(snapshot.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // Each migration must contain, verbatim, the rows generated for it from
    // the snapshot — the OpenRouter rows it seeded and the Vertex mirrors.
    for (const [name, file] of Object.entries(MIGRATIONS)) {
      const migration = await readFile(path.join(here, file), 'utf8');
      const rows = sqlRows(snapshot, name).split(',\n');
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(migration).toContain(row.trim().replace(/,$/, ''));
      }
    }
  });

  it('mirrors a Vertex row from the OpenRouter entry of the same model', () => {
    const snapshot = {
      models: [
        {
          id: 'tariff-1',
          migration: 'V15',
          modelId: 'google/gemini-3.8-flash',
          version: 1,
          inputPerMillion: '75000000',
          cachedInputPerMillion: '7500000',
          outputPerMillion: '375000000',
        },
        {
          id: 'tariff-2',
          migration: 'V8',
          modelId: 'google/gemini-3.1-pro-preview',
          version: 1,
          inputPerMillion: '200000000',
          cachedInputPerMillion: '20000000',
          outputPerMillion: '1200000000',
        },
      ],
    };
    const rows = sqlRows(snapshot, 'V15');
    expect(rows).toContain(
      "('tariff-1', 'openrouter', 'google/gemini-3.8-flash', 1, 75000000, 7500000, 375000000, true)",
    );
    expect(rows).toContain(
      "'vertex', 'gemini-3.8-flash', 2, 75000000, 7500000, 375000000, true)",
    );
    // The mirror's source lives in the snapshot whatever migration seeded it,
    // and a snapshot without it fails loudly.
    expect(rows).toContain(
      "'vertex', 'gemini-3.1-pro-preview', 2, 200000000, 20000000, 1200000000, true)",
    );
    expect(() => sqlRows({ models: [] }, 'V15')).toThrow(/not in the snapshot/);
    // V8 seeded no Vertex mirror: only its own OpenRouter rows.
    expect(sqlRows(snapshot, 'V8')).toBe(
      "    ('tariff-2', 'openrouter', 'google/gemini-3.1-pro-preview', 1, 200000000, 20000000, 1200000000, true)",
    );
  });
});
