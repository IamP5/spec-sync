import type { CatalogPage } from '../../vehicles/api/contracts';
import {
  catalogPageWithContinuation,
  catalogQueryLabel,
} from './catalog-tool-result';

const page: CatalogPage = {
  items: [],
  limit: 20,
  offset: 0,
  hasMore: true,
};

describe('catalog tool result', () => {
  it('derives the continuation of a recorded search from its arguments', () => {
    expect(
      catalogPageWithContinuation(page, {
        q: 'Ranger',
        market: 'BR',
        modelYear: 2026,
      })?.nextSearches,
    ).toEqual([
      { q: 'Ranger', market: 'BR', modelYear: 2026, limit: 20, offset: 0 },
    ]);
  });

  it('keeps server-provided continuations and exhausted pages as they are', () => {
    const provided = { ...page, nextSearches: [] };
    expect(catalogPageWithContinuation(provided, { q: 'x' })).toBe(provided);
    const done = { ...page, hasMore: false };
    expect(catalogPageWithContinuation(done, { q: 'x' })).toBe(done);
    expect(catalogPageWithContinuation(undefined, {})).toBeUndefined();
  });

  it('ignores arguments the catalog would reject', () => {
    expect(
      catalogPageWithContinuation(page, { q: 'Ranger', market: 'brazil' })
        ?.nextSearches,
    ).toBeUndefined();
  });

  it('names the search in the empty outcome', () => {
    expect(
      catalogQueryLabel({ q: 'Shark', market: 'BR', modelYear: 2026 }),
    ).toBe('Shark · BR · 2026');
    expect(catalogQueryLabel({ searches: [] })).toBe('this search');
  });
});
