import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generate, capture } = vi.hoisted(() => ({
  generate: vi.fn(),
  capture: vi.fn(),
}));
vi.mock('@mastra/core/agent', () => ({
  Agent: class {
    generate = generate;
  },
}));
vi.mock('./source', () => ({ captureSource: capture }));

import { extractVehicle } from './extraction';

const input = {
  request: {
    sourceUrl: 'https://www.ford.com.br/specs',
    brand: 'Ford',
    model: 'Test',
    name: 'Test trim',
    market: 'BR' as const,
    modelYear: 2026,
  },
  attributes: [],
};
const claim = {
  attributeCode: 'torque',
  rawValue: '60',
  rawUnit: 'kgf.m',
  availability: null,
  listValue: null,
  qualifiers: [{ name: 'rpm', value: '2000' }],
  lineStart: 2,
  lineEnd: 2,
  locator: 'Torque row',
};
describe('extraction evidence boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capture.mockResolvedValue({
      text: 'Test trim 2026\nTorque 60 kgf.m at 2000 rpm',
    });
  });
  it('builds evidence from captured text and preserves raw units and conditions', async () => {
    generate.mockResolvedValue({
      object: { identityLineStart: 1, identityLineEnd: 1, claims: [claim] },
    });
    const result = await extractVehicle(input, new AbortController().signal);
    expect(result.identityExcerpt).toBe('Test trim 2026');
    expect(result.claims[0]).toMatchObject({
      rawValue: '60',
      rawUnit: 'kgf.m',
      value: null,
      excerpt: 'Torque 60 kgf.m at 2000 rpm',
      qualifiers: { rpm: '2000' },
    });
  });
  it('rejects invented line references instead of generating an evidence quote', async () => {
    generate.mockResolvedValue({
      object: {
        identityLineStart: 1,
        identityLineEnd: 1,
        claims: [{ ...claim, lineEnd: 99 }],
      },
    });
    await expect(
      extractVehicle(input, new AbortController().signal),
    ).rejects.toThrow('invalid evidence span');
  });
  it('validates availability after the simplified provider schema', async () => {
    generate.mockResolvedValue({
      object: {
        identityLineStart: 1,
        identityLineEnd: 1,
        claims: [{ ...claim, availability: 'PROBABLY_STANDARD' }],
      },
    });
    await expect(
      extractVehicle(input, new AbortController().signal),
    ).rejects.toThrow();
  });
});
