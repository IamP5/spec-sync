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
  extractExplicitFuelCells,
  unitPrinted,
  verifyClaims,
  verifyUnmappedObservations,
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
  it('recovers a rate-limit error embedded in HTTP 200 without accepting its partial object', async () => {
    vi.useFakeTimers();
    generate
      .mockResolvedValueOnce({
        object: { claims: [{ ...torque, rawValue: '999' }] },
        finishReason: 'other',
        usage: { outputTokens: 0 },
        response: {
          body: {
            choices: [
              {
                finish_reason: 'error',
                error: { code: 429, message: 'private-provider-message' },
              },
            ],
          },
        },
      })
      .mockResolvedValueOnce({
        object: { claims: [torque] },
        finishReason: 'stop',
      });
    const ownership = vi.fn().mockResolvedValue(undefined);
    try {
      const pending = extractConfigurationClaims(
        input,
        new AbortController().signal,
        ownership,
      );
      await vi.advanceTimersByTimeAsync(16_000);
      const draft = await pending;
      expect(draft.claims[0]?.rawValue).toBe('600');
      expect(generate).toHaveBeenCalledTimes(2);
      expect(ownership).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('bounds transient upstream retries and reports only allowlisted status metadata', async () => {
    vi.useFakeTimers();
    generate.mockResolvedValue({
      finishReason: 'other',
      usage: { outputTokens: 0 },
      steps: [
        {
          response: {
            body: {
              choices: [
                {
                  error: {
                    code: 429,
                    message: 'private-provider-message',
                    metadata: { raw: 'private raw body' },
                  },
                },
              ],
            },
          },
        },
      ],
    });
    try {
      const pending = extractConfigurationClaims(
        input,
        new AbortController().signal,
      );
      const rejected = expect(pending).rejects.toThrow('provider status: 429');
      await vi.advanceTimersByTimeAsync(110_000);
      await rejected;
      expect(generate).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels an upstream retry wait before another paid call', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    generate.mockResolvedValue({
      finishReason: 'other',
      response: { body: { choices: [{ error: { code: 429 } }] } },
    });
    try {
      const pending = extractConfigurationClaims(input, controller.signal);
      const rejected = expect(pending).rejects.toThrow('Lease lost');
      await vi.advanceTimersByTimeAsync(1);
      controller.abort(new Error('Lease lost'));
      await rejected;
      await vi.advanceTimersByTimeAsync(110_000);
      expect(generate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('honors a bounded Retry-After header for transient upstream errors', async () => {
    vi.useFakeTimers();
    generate
      .mockResolvedValueOnce({
        finishReason: 'other',
        response: {
          headers: { 'retry-after': '45' },
          body: { choices: [{ error: { code: 503 } }] },
        },
      })
      .mockResolvedValueOnce({
        object: { claims: [torque] },
        finishReason: 'stop',
      });
    try {
      const pending = extractConfigurationClaims(
        input,
        new AbortController().signal,
      );
      await vi.advanceTimersByTimeAsync(44_000);
      expect(generate).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect((await pending).claims[0]?.rawValue).toBe('600');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps unknown error metadata private and never retries unsupported status codes', async () => {
    generate.mockResolvedValueOnce({
      finishReason: 'other',
      response: {
        body: {
          choices: [
            {
              error: {
                code: 'private-provider-code',
                message: 'private-error',
                metadata: { raw: 'private-body' },
              },
            },
          ],
        },
      },
    });
    await expect(
      extractConfigurationClaims(input, new AbortController().signal),
    ).rejects.toThrow(
      'Specification extraction returned no structured result (finish reason: other; output tokens: unknown; provider status: unknown).',
    );
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('rejects native provider content blocks even with a valid partial object and a misleading normalized stop', async () => {
    generate.mockResolvedValueOnce({
      object: { claims: [torque] },
      finishReason: 'stop',
      usage: { outputTokens: 100 },
      response: {
        body: {
          choices: [
            { native_finish_reason: 'RECITATION', error: { code: 429 } },
          ],
        },
      },
    });
    await expect(
      extractConfigurationClaims(input, new AbortController().signal),
    ).rejects.toThrow('native finish reason: RECITATION');
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('retains evidenced novel facts and uses the pinned exact mapping before a model-suggested meaning', async () => {
    generate.mockResolvedValueOnce({
      object: {
        claims: [
          { ...torque, originalTerm: 'Torque', attributeCode: 'camera_360' },
        ],
        unmappedObservations: [
          {
            originalTerm: 'Câmera 360',
            rawValue: 'S',
            sourceUnit: null,
            qualifiers: [{ name: 'column', value: 'Limited 3.0 V6' }],
            lineStart: 4,
            lineEnd: 4,
            locator: 'Camera row, Limited column',
            proposal: null,
          },
        ],
      },
    });
    const draft = await extractConfigurationClaims(
      {
        ...input,
        terminology: [
          {
            attributeCode: 'torque_max',
            term: 'Torque',
            brand: 'Ford',
            model: null,
            language: 'pt-BR',
            market: 'BR',
            modelYear: null,
          },
        ],
      },
      new AbortController().signal,
    );
    expect(draft.claims[0]).toMatchObject({
      attributeCode: 'torque_max',
      originalTerm: 'Torque',
      rawValue: '600',
    });
    expect(draft.unmappedObservations?.[0]).toMatchObject({
      originalTerm: 'Câmera 360',
      rawValue: 'S',
      termOrigin: 'SOURCE_TEXT',
      excerpt: 'Câmera 360 | - | S',
      qualifiers: { column: 'Limited 3.0 V6' },
    });
    expect(generate).toHaveBeenCalledOnce();
  });

  it('never labels an older paraphrased PDF row as original manufacturer terminology', async () => {
    generate.mockResolvedValueOnce({
      object: { claims: [{ ...torque, originalTerm: 'Torque' }] },
    });
    const draft = await extractConfigurationClaims(
      { ...input, readerRevision: 'specsync-visual-pdf-evidence-v4:model' },
      new AbortController().signal,
    );
    expect(draft.claims[0]?.originalTerm).toBeNull();
  });
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
  it('reports absent structured output without adding model retries', async () => {
    generate.mockResolvedValueOnce({
      object: undefined,
      finishReason: 'length',
      usage: { outputTokens: 8192 },
    });
    await expect(
      extractConfigurationClaims(input, new AbortController().signal),
    ).rejects.toThrow(
      'Specification extraction returned no structured result (finish reason: length; output tokens: 8192).',
    );
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('keeps malformed output diagnostics free of provider response content', async () => {
    generate.mockResolvedValueOnce({
      object: { claims: [{ rawValue: 'private-response' }] },
      finishReason: 'private-provider-response',
      usage: { outputTokens: -1 },
    });
    await expect(
      extractConfigurationClaims(input, new AbortController().signal),
    ).rejects.toThrow(
      'Specification extraction returned invalid structured result (finish reason: unknown; output tokens: unknown).',
    );
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('does not accept missing repair output or add a third generation', async () => {
    generate
      .mockResolvedValueOnce({
        object: { claims: [torque, { ...torque, lineStart: 2, lineEnd: 2 }] },
      })
      .mockResolvedValueOnce({
        object: undefined,
        finishReason: 'error',
        usage: { outputTokens: 0 },
      });
    const ownership = vi.fn().mockResolvedValue(undefined);
    await expect(
      extractConfigurationClaims(
        input,
        new AbortController().signal,
        ownership,
      ),
    ).rejects.toThrow(
      'no structured result (finish reason: error; output tokens: 0)',
    );
    expect(generate).toHaveBeenCalledTimes(2);
    expect(ownership).toHaveBeenCalledTimes(2);
  });
  it('preserves an outer lease cancellation even when generation returns a valid object', async () => {
    const outer = new AbortController();
    const lostLease = new Error('Research lease lost');
    generate.mockImplementationOnce(async () => {
      outer.abort(lostLease);
      return { object: { claims: [torque] }, finishReason: 'stop' };
    });
    await expect(extractConfigurationClaims(input, outer.signal)).rejects.toBe(
      lostLease,
    );
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('honors the unchanged per-call deadline after the SDK resolves', async () => {
    const deadline = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(deadline.signal);
    const expired = new DOMException(
      'Extraction deadline elapsed',
      'TimeoutError',
    );
    generate.mockImplementationOnce(async () => {
      deadline.abort(expired);
      return { object: { claims: [torque] }, finishReason: 'stop' };
    });
    try {
      await expect(
        extractConfigurationClaims(input, new AbortController().signal),
      ).rejects.toBe(expired);
      expect(timeout).toHaveBeenCalledWith(120000);
      expect(generate).toHaveBeenCalledTimes(1);
    } finally {
      timeout.mockRestore();
    }
  });
  it('checks ownership before spending on a generation', async () => {
    const lostLease = new Error('Research lease lost');
    const ownership = vi.fn().mockRejectedValue(lostLease);
    await expect(
      extractConfigurationClaims(
        input,
        new AbortController().signal,
        ownership,
      ),
    ).rejects.toBe(lostLease);
    expect(generate).not.toHaveBeenCalled();
  });
});

describe('unmapped observation evidence', () => {
  const observation = {
    originalTerm: 'Capacidade de reboque',
    rawValue: '3.492',
    sourceUnit: 'kg',
    qualifiers: [{ name: 'brakingCondition', value: 'UNKNOWN' }],
    lineStart: 2,
    lineEnd: 2,
    locator: 'Page 2 towing row, Lariat column',
    proposal: {
      kind: 'ADD_ATTRIBUTE' as const,
      attributeCode: null,
      proposedCode: 'towing_capacity',
      label: 'Towing capacity',
      definition:
        'Trailer mass; braking conditions are independently qualified.',
      valueType: 'NUMBER' as const,
      unit: 'kg',
      dimension: 'mass',
      alternatives: ['Payload is carried vehicle load, not trailer mass.'],
    },
  };
  const source =
    'Page 2\nTowing capacity | 3.492 kg [originalTerm: Capacidade de reboque; originalValue: 3.492 kg]';
  it('keeps raw notation, unknown conditions, the original visual label and its advisory meaning', () => {
    const result = verifyUnmappedObservations(
      { text: source, readerRevision: 'specsync-visual-pdf-evidence-v5:model' },
      [observation],
    );
    expect(result.rejected).toBe(0);
    expect(result.observations[0]).toMatchObject({
      rawValue: '3.492',
      termOrigin: 'VISUAL_LABEL',
      qualifiers: { brakingCondition: 'UNKNOWN' },
      proposal: { proposedCode: 'towing_capacity' },
    });
  });
  it('rejects invented original labels, values, units and anchors', () => {
    const result = verifyUnmappedObservations({ text: source }, [
      { ...observation, originalTerm: 'Carga útil' },
      { ...observation, rawValue: '9.000' },
      { ...observation, sourceUnit: 'lb' },
      { ...observation, lineEnd: 999 },
    ]);
    expect(result).toEqual({ observations: [], rejected: 4 });
  });
  it('retains derived labels explicitly without treating them as Ford alias evidence', () => {
    const result = verifyUnmappedObservations(
      {
        text: 'Page 2\nTowing capacity | 3.492 kg',
        readerRevision: 'specsync-visual-pdf-evidence-v4:model',
      },
      [{ ...observation, originalTerm: 'Towing capacity' }],
    );
    expect(result.observations[0]?.termOrigin).toBe('DERIVED_TEXT');
  });
});

describe('deterministic fuel omissions', () => {
  const fuelAttribute = {
    id: '00000000-0000-4000-8000-000000000003',
    code: 'fuel_type',
    label: 'Combustível',
    description: null,
    valueType: 'LIST' as const,
    unit: null,
  };
  const values = [
    {
      attributeCode: 'fuel_type',
      code: 'GASOLINE',
      aliases: ['Gasolina', 'Gasoline'],
    },
    {
      attributeCode: 'fuel_type',
      code: 'ETHANOL',
      aliases: ['Etanol', 'Ethanol'],
    },
    { attributeCode: 'fuel_type', code: 'DIESEL', aliases: ['Diesel'] },
  ];
  const header = 'Performance Specs | LARIAT BLACK | LARIAT CHROME | TREMOR';
  const fixture = (rows: string[], column = 'LARIAT BLACK') => ({
    ...input,
    text: ['Page 2', header, ...rows].join('\n'),
    attributes: [...attributes, fuelAttribute],
    attributeValues: values,
    readerRevision: 'specsync-visual-pdf-evidence-v4:test',
    scope: {
      name: column,
      found: {
        ...input.scope.found,
        name: column,
        column,
        lineStart: 2,
        lineEnd: 2,
        excerpt: header,
      },
    },
  });

  it('recovers only this trim’s explicit cell through the existing claim verifier', () => {
    for (const [column, fuel] of [
      ['LARIAT BLACK', 'Gasolina'],
      ['LARIAT CHROME', 'Etanol'],
      ['TREMOR', 'Diesel'],
    ]) {
      const claims = extractExplicitFuelCells(
        fixture(['Fuel | Gasolina | Etanol | Diesel'], column),
      );
      expect(claims).toHaveLength(1);
      expect(claims[0]).toMatchObject({
        attributeCode: 'fuel_type',
        listValue: [fuel],
        rawValue: 'Fuel',
        originalTerm: null,
        lineStart: 2,
        lineEnd: 3,
        qualifiers: { column },
      });
      expect(claims[0]?.excerpt).toBe(
        `${header}\nFuel | Gasolina | Etanol | Diesel`,
      );
    }
  });

  it('uses a reordered local header without reading the neighbouring trim cell', () => {
    const claims = extractExplicitFuelCells(
      fixture([
        'Performance Specs | TREMOR | LARIAT CHROME | LARIAT BLACK',
        'Combustível | Diesel | Etanol | Gasolina',
      ]),
    );
    expect(claims[0]).toMatchObject({
      listValue: ['Gasolina'],
      lineStart: 3,
      lineEnd: 4,
    });
  });

  it('does not infer missing cells, novel fuels, absent headers, duplicate columns or another trim', () => {
    for (const rows of [
      ['Fuel | Híbrido leve | Etanol | Diesel'],
      ['Fuel | [unreadable] | Etanol | Diesel'],
      ['Fuel | Gasolina | Etanol'],
      ['Fuel tank capacity (L) | 136 | 136 | 136'],
      [
        'A new section without a table header',
        'Fuel | Gasolina | Etanol | Diesel',
      ],
      [
        'Performance Specs | LARIAT BLACK | LARIAT BLACK | TREMOR',
        'Fuel | Gasolina | Etanol | Diesel',
      ],
      [
        'Versions | Other A | Other B | Other C',
        'Fuel | Gasolina | Etanol | Diesel',
      ],
    ])
      expect(extractExplicitFuelCells(fixture(rows))).toEqual([]);
    expect(
      extractExplicitFuelCells(
        fixture(['Fuel | Gasolina | Etanol | Diesel'], 'UNKNOWN TRIM'),
      ),
    ).toEqual([]);
    expect(
      extractExplicitFuelCells({
        ...fixture(['Fuel | Gasolina | Etanol | Diesel']),
        attributeValues: [],
      }),
    ).toEqual([]);
  });

  it('preserves source-language labels, multi-fuel cells and exact column binding in v5/v6 annotations', () => {
    const claims = extractExplicitFuelCells({
      ...fixture([
        'Fuel type | Gasoline / Ethanol | Diesel | Gasoline [originalTerm: Combustível; originalValue: Gasolina / Etanol | Diesel | Gasolina]',
      ]),
      readerRevision: 'specsync-visual-pdf-evidence-v6:test',
    });
    expect(claims[0]).toMatchObject({
      originalTerm: 'Combustível',
      listValue: ['Gasolina', 'Etanol'],
    });
  });

  it('adds omissions without another model call and retains conflicting explicit rows', async () => {
    generate
      .mockReset()
      .mockResolvedValueOnce({ object: { claims: [] }, finishReason: 'stop' });
    const draft = await extractConfigurationClaims(
      fixture([
        'Fuel | Gasolina | Etanol | Diesel',
        'Fuel | Diesel | Etanol | Diesel',
      ]),
      new AbortController().signal,
    );
    expect(draft.claims.map((claim) => claim.listValue)).toEqual([
      ['Gasolina'],
      ['Diesel'],
    ]);
    expect(
      draft.warnings.some((warning) => warning.includes('conflicting fuel')),
    ).toBe(true);
    expect(generate).toHaveBeenCalledOnce();
  });

  it('does not duplicate an existing fuel claim or turn an engine qualifier into an unsupported fuel fact', async () => {
    const source = fixture(['Fuel | Gasolina | Etanol | Diesel']);
    generate.mockReset().mockResolvedValueOnce({
      object: {
        claims: [
          {
            attributeCode: 'fuel_type',
            originalTerm: null,
            rawValue: 'Fuel',
            rawUnit: null,
            availability: null,
            listValue: ['Gasolina'],
            qualifiers: [],
            lineStart: 2,
            lineEnd: 3,
            locator: 'Fuel row, LARIAT BLACK column',
          },
        ],
      },
      finishReason: 'stop',
    });
    expect(
      (await extractConfigurationClaims(source, new AbortController().signal))
        .claims,
    ).toHaveLength(1);
    expect(
      extractExplicitFuelCells(fixture(['Power (Gasolina) | 400 | 401 | 402'])),
    ).toEqual([]);
  });

  it('deduplicates a source-language fuel synonym against its existing translated observation', async () => {
    const source = {
      ...fixture([
        'Fuel type | Gasoline | Diesel | Gasoline [originalTerm: Combustível; originalValue: Gasolina | Diesel | Gasolina]',
      ]),
      readerRevision: 'specsync-visual-pdf-evidence-v6:test',
    };
    generate.mockReset().mockResolvedValueOnce({
      object: {
        claims: [
          {
            attributeCode: 'fuel_type',
            originalTerm: 'Combustível',
            rawValue: 'Fuel type',
            rawUnit: null,
            availability: null,
            listValue: ['Gasoline'],
            qualifiers: [],
            lineStart: 2,
            lineEnd: 3,
            locator: 'Fuel row, LARIAT BLACK column',
          },
        ],
      },
      finishReason: 'stop',
    });
    const draft = await extractConfigurationClaims(
      source,
      new AbortController().signal,
    );
    expect(draft.claims).toHaveLength(1);
    expect(draft.warnings).toEqual([]);
  });
});
