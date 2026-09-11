import { describe, expect, it } from 'vitest';

import {
  resolvedWorkspaceTileSchema,
  vehicleWorkspaceInputSchema,
} from './contracts';

const configurationId = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1';
const anotherId = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a2';
const catalog = { type: 'catalog', title: 'Available trucks', q: 'Ranger' };

describe('vehicle workspace intent boundary', () => {
  it('supplies bounded defaults while preserving existing catalog constraints', () => {
    expect(
      vehicleWorkspaceInputSchema.parse({
        title: '  Trucks  ',
        tiles: [
          catalog,
          { type: 'reviews', title: 'Ride quality', configurationId },
        ],
      }),
    ).toEqual({
      title: 'Trucks',
      tiles: [
        { ...catalog, limit: 6 },
        {
          type: 'reviews',
          title: 'Ride quality',
          configurationId,
          q: '',
          limit: 4,
        },
      ],
    });
    expect(
      vehicleWorkspaceInputSchema.safeParse({
        title: 'Trucks',
        tiles: [
          {
            ...catalog,
            market: 'BR',
            modelYear: 2200,
            q: 'a'.repeat(100),
            limit: 8,
          },
        ],
      }).success,
    ).toBe(true);
  });

  it.each(
    [
      [],
      Array.from({ length: 5 }, () => catalog),
      [{ ...catalog, limit: 9 }],
      [{ ...catalog, limit: 0 }],
      [{ ...catalog, limit: 1.5 }],
      [{ ...catalog, q: 'x'.repeat(101) }],
      [{ ...catalog, market: 'Brazil' }],
      [{ ...catalog, market: 'br' }],
      [{ ...catalog, modelYear: 1899 }],
      [{ ...catalog, modelYear: 2201 }],
      [{ ...catalog, modelYear: 2026.5 }],
      [{ ...catalog, offset: 8 }],
      [{ ...catalog, title: '' }],
      [{ ...catalog, title: 'x'.repeat(121) }],
      [
        {
          type: 'comparison',
          title: 'Compare',
          configurationIds: [configurationId],
          attributes: ['torque'],
        },
      ],
      [
        {
          type: 'comparison',
          title: 'Compare',
          configurationIds: Array.from({ length: 6 }, () => configurationId),
          attributes: ['torque'],
        },
      ],
      [
        {
          type: 'comparison',
          title: 'Compare',
          configurationIds: [configurationId, 'invented-trim'],
          attributes: ['torque'],
        },
      ],
      [
        {
          type: 'comparison',
          title: 'Compare',
          configurationIds: [configurationId, anotherId],
          attributes: Array.from({ length: 13 }, () => 'torque'),
        },
      ],
      [
        {
          type: 'specifications',
          title: 'Specs',
          configurationId: 'Ranger',
          attributes: ['torque'],
        },
      ],
      [
        {
          type: 'specifications',
          title: 'Specs',
          configurationId,
          attributes: ['arbitrary markup'],
        },
      ],
      [{ type: 'reviews', title: 'Reviews', configurationId, limit: 7 }],
      [
        {
          type: 'reviews',
          title: 'Reviews',
          configurationId,
          q: 'x'.repeat(201),
        },
      ],
      [
        {
          type: 'reviews',
          title: 'Reviews',
          configurationId,
          attributeCode: '<script>',
        },
      ],
      [{ type: 'reviews', title: 'Reviews' }],
    ].map((tiles) => ({ tiles })),
  )('rejects malformed or unbounded tiles %#', ({ tiles }) => {
    expect(
      vehicleWorkspaceInputSchema.safeParse({ title: 'Trucks', tiles }).success,
    ).toBe(false);
  });

  it.each([
    { ...catalog, result: { horsepower: 999 } },
    { ...catalog, html: '<script>alert(1)</script>' },
    { ...catalog, component: 'ArbitraryRemoteWidget' },
    { ...catalog, url: 'https://untrusted.example' },
    { type: 'script', title: 'Run this', source: 'alert(1)' },
  ])('rejects model-supplied facts, code and unknown fields %#', (tile) => {
    expect(
      vehicleWorkspaceInputSchema.safeParse({ title: 'Trucks', tiles: [tile] })
        .success,
    ).toBe(false);
  });

  it('rejects unknown top-level fields and blank workspace titles', () => {
    expect(
      vehicleWorkspaceInputSchema.safeParse({
        title: 'Trucks',
        tiles: [catalog],
        html: 'untrusted',
      }).success,
    ).toBe(false);
    expect(
      vehicleWorkspaceInputSchema.safeParse({ title: '  ', tiles: [catalog] })
        .success,
    ).toBe(false);
  });

  it.each([
    { type: 'comparison', configurationIds: [configurationId, anotherId] },
    { type: 'specifications', configurationId },
  ])(
    'requires a bounded explicit attribute selection for $type',
    (selection) => {
      const { type, ...identity } = selection;
      const parseInput = (args: object) =>
        vehicleWorkspaceInputSchema.safeParse({
          title: 'Trucks',
          tiles: [{ type, title: 'Specifications', ...args }],
        });
      const parseOutput = (args: object) =>
        resolvedWorkspaceTileSchema.safeParse({
          type,
          title: 'Specifications',
          args,
          result: { configurations: [], rows: [] },
        });
      for (const args of [
        identity,
        { ...identity, attributes: [] },
        {
          ...identity,
          attributes: Array.from(
            { length: 13 },
            (_, index) => `attribute_${index}`,
          ),
        },
      ]) {
        expect(parseInput(args).success).toBe(false);
        expect(parseOutput(args).success).toBe(false);
      }
      for (const attributes of [
        ['torque'],
        Array.from({ length: 12 }, (_, index) => `attribute_${index}`),
      ]) {
        const args = { ...identity, attributes };
        expect(parseInput(args).success).toBe(true);
        expect(parseOutput(args).success).toBe(true);
      }
    },
  );
});
