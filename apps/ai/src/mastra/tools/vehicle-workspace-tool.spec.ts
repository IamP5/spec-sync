import { noopObserve } from '@mastra/core/tools';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { retrieveReviews } from '../catalog/review-search';
import {
  vehicleWorkspaceInputSchema,
  vehicleWorkspaceOutputSchema,
} from '../workspace/contracts';
import { retrieveVehicleWorkspace } from '../workspace/retrieval';
import { renderVehicleWorkspace } from './vehicle-workspace-tool';

vi.mock('../catalog/review-search', () => ({ retrieveReviews: vi.fn() }));

const firstId = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1';
const secondId = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a2';
const surfaceId = `workspace-${firstId}`;
const configuration = {
  id: firstId,
  brand: 'Ford',
  model: 'Ranger',
  name: 'Limited',
  market: 'BR',
  modelYear: 2026,
  identityStatus: 'RESOLVED',
  identityNote: null,
  identityEvidenceId: null,
};
const page = { items: [configuration], limit: 6, offset: 0, hasMore: false };
const comparison = {
  configurations: [
    configuration,
    { ...configuration, id: secondId, name: 'XLT' },
  ],
  rows: [
    {
      attribute: {
        id: firstId,
        code: 'torque',
        label: 'Torque',
        description: null,
        valueType: 'NUMBER',
        unit: 'Nm',
      },
      cells: [
        {
          configurationId: firstId,
          knowledgeStatus: 'CONFLICTING',
          reason: 'Sources disagree; no winner selected.',
          selectedObservationId: null,
          observations: [
            {
              id: firstId,
              value: 600,
              availability: null,
              qualifiers: { engine: 'V6', requiresPackage: 'tow' },
              rawValue: '600 Nm',
              reviewStatus: 'ACCEPTED',
              evidence: [
                {
                  id: firstId,
                  sourceRevisionId: secondId,
                  title: 'Manufacturer brochure',
                  path: 'sources/ranger.txt',
                  sha256: 'original-digest',
                  provenance: 'MANUFACTURER',
                  capturedOn: '2026-09-10',
                  publishedOn: null,
                  upstreamUrls: ['https://example.com/brochure.pdf'],
                  lineStart: 4,
                  lineEnd: 5,
                  locator: 'Page 2',
                  excerpt: 'Torque máximo: 600 Nm. Requires tow package.',
                },
              ],
            },
          ],
        },
        {
          configurationId: secondId,
          knowledgeStatus: 'NOT_REPORTED',
          reason: 'No accepted observation.',
          selectedObservationId: null,
          observations: [],
        },
      ],
    },
  ],
};
const reviews = {
  status: 'OK',
  message: 'Stored passages',
  projectionVersion: 'reviews-12',
  items: [
    {
      kind: 'REVIEW_OBSERVATION',
      opinionKind: 'REVIEWER_MEASUREMENT',
      applicability: 'MODEL',
      excerpt: 'A suspensão foi confortável neste percurso.',
      sourceUrl: 'https://example.com/review',
      timestamp: '00:03:24',
    },
  ],
};

beforeEach(() => {
  vi.mocked(retrieveReviews)
    .mockReset()
    .mockResolvedValue(reviews as never);
});
afterEach(() => vi.unstubAllGlobals());

describe('renderVehicleWorkspace', () => {
  it('rejects unbounded attribute requests before contacting the catalog', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const selection of [
      { type: 'comparison', configurationIds: [firstId, secondId] },
      { type: 'specifications', configurationId: firstId },
    ]) {
      for (const attributes of [undefined, []]) {
        await expect(
          retrieveVehicleWorkspace({
            title: 'Truck research',
            tiles: [{ ...selection, title: 'Specs', attributes }],
          } as never),
        ).rejects.toThrow();
      }
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches each intent from its existing authority and preserves exact provenance', async () => {
    const fetch = vi.fn(
      async (url: URL) =>
        new Response(
          JSON.stringify(
            url.pathname === '/api/vehicle-configurations' ? page : comparison,
          ),
        ),
    );
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    const input = vehicleWorkspaceInputSchema.parse({
      title: 'Ranger decision workspace',
      tiles: [
        {
          type: 'catalog',
          title: 'Catalog',
          q: 'Ranger',
          market: 'BR',
          modelYear: 2026,
        },
        {
          type: 'comparison',
          title: 'Torque comparison',
          configurationIds: [firstId, secondId],
          attributes: ['torque'],
        },
        {
          type: 'specifications',
          title: 'Sources',
          configurationId: firstId,
          attributes: ['torque'],
        },
        {
          type: 'reviews',
          title: 'Comfort opinions',
          configurationId: firstId,
          q: 'comfort',
        },
      ],
    });
    const result = await renderVehicleWorkspace.execute?.(input, {
      observe: noopObserve,
      abortSignal: controller.signal,
    });
    const workspace = vehicleWorkspaceOutputSchema.parse(result);
    expect(workspace.status).toBe('OK');
    expect(workspace.operations[0].createSurface.surfaceId).toMatch(
      /^workspace-[0-9a-f-]{36}$/,
    );
    const tiles = workspace.operations[2].updateDataModel.value.tiles;
    expect(tiles.map((tile) => tile.result)).toEqual([
      page,
      comparison,
      comparison,
      reviews,
    ]);
    expect(tiles.map((tile) => tile.args)).toEqual([
      { q: 'Ranger', market: 'BR', modelYear: 2026, limit: 6, offset: 0 },
      { configurationIds: [firstId, secondId], attributes: ['torque'] },
      { configurationId: firstId, attributes: ['torque'] },
      { configurationId: firstId, q: 'comfort', limit: 4 },
    ]);
    expect(fetch.mock.calls.map(([url]) => url.pathname)).toEqual([
      '/api/vehicle-configurations',
      '/api/comparisons',
      '/api/vehicle-specifications',
    ]);
    expect(fetch.mock.calls[0]?.[0].searchParams.get('limit')).toBe('6');
    expect(fetch.mock.calls[1]?.[0].searchParams.get('configurationIds')).toBe(
      `${firstId},${secondId}`,
    );
    expect(retrieveReviews).toHaveBeenCalledWith(
      { configurationId: firstId, q: 'comfort', limit: 4 },
      controller.signal,
    );
  });

  it('deduplicates identical requests regardless of title, only within one invocation', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(page)));
    vi.stubGlobal('fetch', fetch);
    const input = vehicleWorkspaceInputSchema.parse({
      title: 'Truck research',
      tiles: [
        { type: 'catalog', title: 'First view', q: 'Ranger' },
        { type: 'catalog', title: 'Second view', q: 'Ranger', limit: 6 },
        { type: 'reviews', title: 'First evidence', configurationId: firstId },
        {
          type: 'reviews',
          title: 'Second evidence',
          configurationId: firstId,
          q: '',
          limit: 4,
        },
      ],
    });
    const output = await retrieveVehicleWorkspace(input, undefined, surfaceId);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(retrieveReviews).toHaveBeenCalledTimes(1);
    expect(
      output.operations[2].updateDataModel.value.tiles.map(
        (tile) => tile.title,
      ),
    ).toEqual(input.tiles.map((tile) => tile.title));
    const second = await retrieveVehicleWorkspace(input, undefined, surfaceId);
    expect(second).toEqual(output);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(retrieveReviews).toHaveBeenCalledTimes(2);
  });

  it('retains successful panels and sanitized failures when one backend is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL) =>
        url.pathname === '/api/vehicle-configurations'
          ? new Response(JSON.stringify(page))
          : new Response('private backend details', { status: 503 }),
      ),
    );
    const input = vehicleWorkspaceInputSchema.parse({
      title: 'Truck research',
      tiles: [
        { type: 'catalog', title: 'Catalog', q: 'Ranger' },
        {
          type: 'specifications',
          title: 'Specs',
          configurationId: firstId,
          attributes: ['torque'],
        },
      ],
    });
    const output = await retrieveVehicleWorkspace(input, undefined, surfaceId);
    expect(output.status).toBe('PARTIAL');
    expect(
      output.operations[2].updateDataModel.value.tiles.map(
        (tile) => tile.result,
      ),
    ).toEqual([
      page,
      {
        status: 'ERROR',
        message: 'Catalog request failed (503).',
        retryable: true,
      },
    ]);
    expect(JSON.stringify(output)).not.toContain('private backend details');
  });

  it('rejects a malformed authoritative response without laundering it into facts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ configurations: ['invented vehicle'], rows: [] }),
          ),
      ),
    );
    const input = vehicleWorkspaceInputSchema.parse({
      title: 'Truck research',
      tiles: [
        {
          type: 'specifications',
          title: 'Specs',
          configurationId: firstId,
          attributes: ['torque'],
        },
      ],
    });
    const output = await retrieveVehicleWorkspace(input);
    expect(output.status).toBe('ERROR');
    expect(
      output.operations[2].updateDataModel.value.tiles[0]?.result,
    ).toMatchObject({ status: 'ERROR', retryable: true });
    expect(JSON.stringify(output)).not.toContain('invented vehicle');
  });

  it('does not fetch when cancelled before execution', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const controller = new AbortController();
    controller.abort();
    const input = vehicleWorkspaceInputSchema.parse({
      title: 'Truck research',
      tiles: [{ type: 'catalog', title: 'Catalog', q: 'Ranger' }],
    });
    await expect(
      retrieveVehicleWorkspace(input, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('propagates in-flight cancellation through every request and beyond failure wrappers', async () => {
    const fetch = vi.fn(
      (_url: URL, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener(
            'abort',
            () => reject(init.signal?.reason),
            { once: true },
          );
        }),
    );
    vi.stubGlobal('fetch', fetch);
    vi.mocked(retrieveReviews).mockImplementation(
      (_input, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    const input = vehicleWorkspaceInputSchema.parse({
      title: 'Truck research',
      tiles: [
        { type: 'catalog', title: 'Catalog', q: 'Ranger' },
        { type: 'reviews', title: 'Reviews', configurationId: firstId },
      ],
    });
    const controller = new AbortController();
    const pending = retrieveVehicleWorkspace(input, controller.signal);
    const rejection = expect(pending).rejects.toMatchObject({
      name: 'AbortError',
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    controller.abort();
    await rejection;
    expect(fetch.mock.calls[0]?.[1].signal?.aborted).toBe(true);
    expect(retrieveReviews).toHaveBeenCalledWith(
      expect.anything(),
      controller.signal,
    );
  });
});
