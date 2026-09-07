import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('@mastra/core/agent', () => ({
  Agent: class {
    generate = generate;
  },
}));

import {
  containsValue,
  extractConfigurationClaims,
  unitPrinted,
  verifyClaims,
} from './extraction';

const text = [
  'NOVA RANGER 2026',
  'Versão | XLS 2.0 | Limited 3.0 V6',
  'Torque | 405 Nm | 600 Nm',
  'Câmera 360 | - | S',
  'S: série. -: não disponível.',
].join('\n');
const attributes = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'torque_max',
    label: 'Torque',
    description: null,
    valueType: 'NUMBER' as const,
    unit: 'Nm',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    code: 'camera_360',
    label: 'Camera 360',
    description: null,
    valueType: 'AVAILABILITY' as const,
    unit: null,
  },
];
const input = {
  text,
  request: {
    sourceUrl: 'https://www.ford.com.br/specs',
    brand: 'Ford',
    model: 'Ranger',
    market: 'BR' as const,
    modelYear: 2026,
    configurations: ['Limited 3.0 V6 AT Diesel'],
  },
  attributes,
  scope: {
    name: 'Limited 3.0 V6 AT Diesel',
    found: {
      name: 'Limited 3.0 V6',
      powertrain: '3.0 V6',
      column: 'Limited 3.0 V6',
      lineStart: 2,
      lineEnd: 2,
      locator: 'Column header',
      excerpt: 'Versão | XLS 2.0 | Limited 3.0 V6',
    },
  },
  legend: [{ symbol: 'S', meaning: 'série' }],
};
const torque = {
  attributeCode: 'torque_max',
  rawValue: '600',
  rawUnit: 'Nm',
  availability: null,
  listValue: null,
  qualifiers: [{ name: 'column', value: 'Limited 3.0 V6' }],
  lineStart: 3,
  lineEnd: 3,
  locator: 'Torque row, Limited column',
};

describe('claim verification', () => {
  const codes = new Map<string, 'NUMBER' | 'AVAILABILITY'>([
    ['torque_max', 'NUMBER'],
    ['camera_360', 'AVAILABILITY'],
  ]);
  it('cuts evidence from the stored text and keeps raw notation and qualifiers', () => {
    const { accepted, rejected } = verifyClaims(text, [torque], codes);
    expect(rejected).toEqual([]);
    expect(accepted[0]).toMatchObject({
      rawValue: '600',
      rawUnit: 'Nm',
      excerpt: 'Torque | 405 Nm | 600 Nm',
      qualifiers: { column: 'Limited 3.0 V6' },
      value: null,
      issues: [],
    });
  });
  it('rejects invented line references, values absent from the lines and unknown attributes', () => {
    const { accepted, rejected } = verifyClaims(
      text,
      [
        { ...torque, lineEnd: 99 },
        { ...torque, rawValue: '700' },
        { ...torque, attributeCode: 'wheel_size' },
        {
          ...torque,
          attributeCode: 'camera_360',
          rawValue: 'S',
          rawUnit: null,
          lineStart: 4,
          lineEnd: 4,
          availability: 'PROBABLY_STANDARD',
        },
      ],
      codes,
    );
    expect(accepted).toEqual([]);
    expect(rejected.map(({ reason }) => reason)).toEqual([
      'the line range does not exist in the source',
      'lines 3-3 do not contain "700"',
      'unknown attribute code wheel_size',
      'the claim is malformed (availability, locator or bounds)',
    ]);
  });
  it('matches short markers only as whole cells or words', () => {
    expect(containsValue('Câmera 360 | - | S', 'S')).toBe(true);
    expect(containsValue('Câmera 360 | - | S', '-')).toBe(true);
    expect(containsValue('S: série. -: não disponível.', 'S')).toBe(true);
    expect(containsValue('Torque | 405 Nm | 600 Nm', 'S')).toBe(false);
    expect(containsValue('Sensor de chuva | O', 'S')).toBe(false);
    expect(containsValue('Torque | 405 Nm | 600 Nm', '600')).toBe(true);
  });
  it('rejects units the source does not print and availability on plain values', () => {
    expect(unitPrinted('Motor 2.0 turbo Diesel', 'cm3')).toBe(false);
    expect(unitPrinted('Cilindrada | 1.996 cm³', 'cm3')).toBe(true);
    expect(unitPrinted('Torque | 60 kgf·m', 'kgf.m')).toBe(true);
    const { accepted, rejected } = verifyClaims(
      text,
      [
        { ...torque, rawUnit: 'kgf.m' },
        { ...torque, availability: 'STANDARD' },
        { ...torque, availability: 'ABSENT' },
      ],
      codes,
    );
    expect(rejected.map(({ reason }) => reason)).toEqual([
      'the unit "kgf.m" is not printed in the evidence lines',
      'the value is marked as not applying to this configuration',
    ]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]?.availability).toBeNull();
  });
  it('drops exact duplicates', () => {
    expect(verifyClaims(text, [torque, torque], codes).accepted).toHaveLength(
      1,
    );
  });
});

describe('configuration extraction', () => {
  beforeEach(() => vi.clearAllMocks());
  it('repairs failed claims once and reports what was dropped', async () => {
    generate
      .mockResolvedValueOnce({
        object: {
          claims: [
            torque,
            { ...torque, lineStart: 2, lineEnd: 2 },
            {
              attributeCode: 'camera_360',
              rawValue: 'S',
              rawUnit: null,
              availability: 'STANDARD',
              listValue: null,
              qualifiers: [],
              lineStart: 3,
              lineEnd: 3,
              locator: 'Camera row',
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        object: {
          claims: [
            {
              attributeCode: 'camera_360',
              rawValue: 'S',
              rawUnit: null,
              availability: 'STANDARD',
              listValue: null,
              qualifiers: [],
              lineStart: 4,
              lineEnd: 4,
              locator: 'Camera row, Limited column',
            },
            { ...torque, lineStart: 1, lineEnd: 1 },
          ],
        },
      });
    const draft = await extractConfigurationClaims(
      input,
      new AbortController().signal,
    );
    expect(generate).toHaveBeenCalledTimes(2);
    expect(JSON.parse(generate.mock.calls[1]?.[0]).claimsToRepair).toHaveLength(
      2,
    );
    expect(draft.name).toBe('Limited 3.0 V6 AT Diesel');
    expect(draft.identityExcerpt).toBe('Versão | XLS 2.0 | Limited 3.0 V6');
    expect(draft.claims.map((claim) => claim.attributeCode)).toEqual([
      'torque_max',
      'camera_360',
    ]);
    expect(draft.claims[1]).toMatchObject({
      availability: 'STANDARD',
      excerpt: 'Câmera 360 | - | S',
    });
    expect(draft.warnings[0]).toContain('1 proposed claim(s) were dropped');
  });
  it('does not call the repair pass when every claim verifies', async () => {
    generate.mockResolvedValueOnce({ object: { claims: [torque] } });
    const draft = await extractConfigurationClaims(
      input,
      new AbortController().signal,
    );
    expect(generate).toHaveBeenCalledTimes(1);
    expect(draft.warnings).toEqual([]);
    expect(draft.claims).toHaveLength(1);
  });
});
