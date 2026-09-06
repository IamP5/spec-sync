import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { catalogRequest, withToolFailure } from './api-client';

afterEach(() => vi.unstubAllGlobals());
describe('catalog HTTP boundary', () => {
  it('encodes user text without letting it change the destination', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"items":[]}'));
    vi.stubGlobal('fetch', fetch);
    await catalogRequest(
      '/api/vehicle-configurations',
      { q: 'Ranger & market=US', attributes: ['power_max', 'torque_max'] },
      z.object({ items: z.array(z.unknown()) }),
    );
    const url = fetch.mock.calls[0]?.[0] as URL;
    expect(url.pathname).toBe('/api/vehicle-configurations');
    expect(url.searchParams.get('q')).toBe('Ranger & market=US');
    expect(url.searchParams.has('market')).toBe(false);
  });
  it('does not present invalid provider content as catalog facts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"items":"wrong"}')),
    );
    const result = await withToolFailure(() =>
      catalogRequest(
        '/api/comparison-attributes',
        {},
        z.object({ items: z.array(z.unknown()) }),
      ),
    );
    expect(result).toMatchObject({ status: 'ERROR' });
  });
  it('distinguishes invalid selections from retryable outages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 422 })),
    );
    expect(
      await withToolFailure(() =>
        catalogRequest('/api/comparisons', {}, z.unknown()),
      ),
    ).toMatchObject({ status: 'ERROR', retryable: false });
  });
  it('sends review vectors in a JSON body instead of the URL', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{"items":[]}'));
    vi.stubGlobal('fetch', fetch);
    const params = { q: 'ride comfort', embedding: Array(768).fill(0.1) };
    await catalogRequest('/api/knowledge/reviews', params, z.unknown());
    const [url, options] = fetch.mock.calls[0] as [URL, RequestInit];
    expect(url.search).toBe('');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body as string)).toEqual(params);
  });
  it('forwards cancellation to fetch', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch = vi.fn().mockImplementation((_url, options) => {
      expect(options.signal.aborted).toBe(true);
      throw new Error('aborted');
    });
    vi.stubGlobal('fetch', fetch);
    expect(
      await withToolFailure(() =>
        catalogRequest('/api/comparisons', {}, z.unknown(), controller.signal),
      ),
    ).toMatchObject({ status: 'ERROR' });
  });
});
