import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
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
  it('prices exactly the seeded models and feeds the V8 rows', async () => {
    const snapshot = JSON.parse(
      await readFile(path.join(here, 'openrouter-tariffs.json'), 'utf8'),
    );
    expect(snapshot.models.map((model) => model.modelId)).toEqual(
      SEEDED_MODELS,
    );
    expect(snapshot.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // The migration must contain, verbatim, the rows generated from the snapshot.
    const migration = await readFile(
      path.join(
        here,
        '../../apps/api/src/main/resources/db/migration/V8__openrouter_credits.sql',
      ),
      'utf8',
    );
    for (const row of sqlRows(snapshot).split(',\n')) {
      expect(migration).toContain(row.trim().replace(/,$/, ''));
    }
  });
});
