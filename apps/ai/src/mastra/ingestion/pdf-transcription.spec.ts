import { afterEach, describe, expect, it, vi } from 'vitest';

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('@mastra/core/agent', () => ({
  Agent: class {
    generate = generate;
  },
}));

import { transcribePdf, validateTranscript } from './pdf-transcription';

it('anchors short original terminology and values to the correct compact factual row', () => {
  expect(
    validateTranscript(
      {
        pages: [
          {
            page: 1,
            lines: ['Fuel type | Gasoline'],
            originalTerms: [
              { line: 1, originalTerm: 'Combustível', rawValue: 'Gasolina' },
            ],
          },
        ],
      },
      1,
    ),
  ).toBe(
    'Page 1\nFuel type | Gasoline [originalTerm: Combustível; originalValue: Gasolina]',
  );
  expect(() =>
    validateTranscript(
      {
        pages: [
          {
            page: 1,
            lines: ['Fuel type | Gasoline'],
            originalTerms: [
              { line: 2, originalTerm: 'Combustível', rawValue: 'Gasolina' },
            ],
          },
        ],
      },
      1,
    ),
  ).toThrow('missing factual row');
});

describe('publication metadata uncertainty', () => {
  it('keeps a misread date as an explicitly unverified candidate without altering technical evidence', () => {
    const result = validateTranscript(
      {
        pages: [
          {
            page: 1,
            lines: [
              'Publication date: 09/2024',
              'Technical specifications | LARIAT BLACK | LARIAT CHROME | TREMOR',
              'Fuel: Gasolina | Gasolina | Gasolina',
              'Towing capacity: 3492 kg | 3492 kg | 3945 kg',
            ],
            originalTerms: [
              {
                line: 3,
                originalTerm: 'Combustível',
                rawValue: 'Gasolina | Gasolina | Gasolina',
              },
              {
                line: 4,
                originalTerm: 'Capacidade de reboque (kg)',
                rawValue: '3492 | 3492 | 3945',
              },
            ],
          },
        ],
      },
      1,
    );
    expect(result.split('\n')[1]).toBe(
      'Unverified publication-date candidate (not model-year evidence): Publication date: 09/2024',
    );
    expect(result).toContain(
      'Technical specifications | LARIAT BLACK | LARIAT CHROME | TREMOR',
    );
    expect(result).toContain(
      'Fuel: Gasolina | Gasolina | Gasolina [originalTerm: Combustível; originalValue: Gasolina | Gasolina | Gasolina]',
    );
    expect(result).toContain(
      'Towing capacity: 3492 kg | 3492 kg | 3945 kg [originalTerm: Capacidade de reboque (kg); originalValue: 3492 | 3492 | 3945]',
    );
  });

  it.each([
    'Publication date candidate',
    'Published',
    'Brochure publication date',
    'Data de publicação',
    'Data de edição',
    'Document year',
  ])('marks the recognized metadata label %s unverified', (label) => {
    const row = `${label}: 09/2024`;
    expect(validateTranscript({ pages: [{ page: 1, lines: [row] }] }, 1)).toBe(
      `Page 1\nUnverified publication-date candidate (not model-year evidence): ${row}`,
    );
  });

  it('does not change explicit model-year or warranty factual rows', () => {
    const lines = [
      'Model year: 2026',
      'Vehicle warranty: 5 years unlimited mileage',
    ];
    expect(validateTranscript({ pages: [{ page: 1, lines }] }, 1)).toBe(
      `Page 1\n${lines.join('\n')}`,
    );
  });
});

/** A real vector PDF, so the regression exercises the rendering boundary too. */
function onePagePdf(pageCount = 1): string {
  const drawing = '0 0 1 rg 10 10 100 50 re f';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, index) => `${index + 3} 0 R`).join(' ')}] /Count ${pageCount} >>`,
    ...Array.from(
      { length: pageCount },
      () =>
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << >> /Contents ${pageCount + 3} 0 R >>`,
    ),
    `<< /Length ${drawing.length} >>\nstream\n${drawing}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf).toString('base64');
}

afterEach(() => generate.mockReset());

describe('visual PDF provider-result regression', () => {
  it('bounds an unclassified empty provider result to one retry with completeness guidance', async () => {
    const usage = { inputTokens: 100, outputTokens: 0 };
    generate.mockResolvedValue({
      text: '',
      object: undefined,
      finishReason: 'other',
      usage,
    });
    const onUsage = vi.fn();
    const assertOwnership = vi.fn().mockResolvedValue(undefined);

    await expect(
      transcribePdf(
        onePagePdf(),
        1,
        new AbortController().signal,
        onUsage,
        undefined,
        assertOwnership,
      ),
    ).rejects.toThrow(
      'PDF evidence extraction did not complete (finish reason: other',
    );

    expect(generate).toHaveBeenCalledTimes(2);
    expect(onUsage.mock.calls).toEqual([[usage], [usage]]);
    expect(assertOwnership).toHaveBeenCalledTimes(2);
    const [messages, options] = generate.mock.calls[0] ?? [];
    expect(messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Page 1' },
          {
            type: 'image',
            image: expect.stringMatching(/^data:image\/png;base64,/),
            mimeType: 'image/png',
          },
        ],
      },
    ]);
    expect(options).toMatchObject({
      structuredOutput: { schema: expect.anything() },
      maxSteps: 1,
      modelSettings: { maxOutputTokens: 40000, temperature: 0 },
      abortSignal: expect.any(AbortSignal),
    });
    expect(generate.mock.calls[1]?.[0][0].content.slice(0, 2)).toEqual(
      messages[0].content,
    );
    expect(generate.mock.calls[1]?.[0][0].content.at(-1)).toMatchObject({
      type: 'text',
      text: expect.stringContaining('previous attempt'),
    });
    expect(generate.mock.calls[1]?.[1].structuredOutput).toEqual(
      options.structuredOutput,
    );
  });

  it('accepts a complete structured transcript through the same real renderer', async () => {
    const lines = [
      'Synthetic specification fixture',
      'Configuration | Base | Sport',
      'Torque | 400 Nm | 450 Nm',
      'Source note: this is mocked provider output, not an extraction accuracy fixture.',
    ];
    generate.mockResolvedValue({
      text: '',
      finishReason: 'stop',
      object: { pages: [{ page: 1, lines }] },
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    const result = await transcribePdf(
      onePagePdf(),
      1,
      new AbortController().signal,
    );
    expect(result.text).toBe(`Page 1\n${lines.join('\n')}`);
    expect(result.parserVersion).toMatch(/^specsync-visual-pdf-evidence-v6:/);
    expect(generate).toHaveBeenCalledOnce();
  });
});

describe('visual PDF transcript validation', () => {
  it('preserves table columns and footnotes without interpreting symbols', () => {
    const lines = [
      'NOVA GERAÇÃO FORD RANGER',
      'Versão | XLT | Limited',
      'Torque | 600 Nm | 600 Nm',
      'Câmera 360 | - | x',
      'x: disponível no kit opcional. Confirmar versão e ano antes da publicação.',
    ];
    expect(validateTranscript({ pages: [{ page: 1, lines }] }, 1)).toBe(
      `Page 1\n${lines.join('\n')}`,
    );
  });
  it('validates a later batch against its own first page', () => {
    const lines = ['a'.repeat(120)];
    expect(
      validateTranscript(
        {
          pages: [
            { page: 5, lines },
            { page: 6, lines: [] },
          ],
        },
        2,
        5,
      ),
    ).toBe(`Page 5\n${lines[0]}\nPage 6\n`);
    expect(() =>
      validateTranscript({ pages: [{ page: 1, lines }] }, 1, 5),
    ).toThrow('omitted or reordered');
  });
  it('rejects missing, duplicated and reordered pages', () => {
    for (const pages of [
      [{ page: 1, lines: [] }],
      [
        { page: 2, lines: [] },
        { page: 1, lines: [] },
      ],
      [
        { page: 1, lines: [] },
        { page: 1, lines: [] },
      ],
    ])
      expect(() => validateTranscript({ pages }, 2)).toThrow(
        'omitted or reordered',
      );
  });
  it('rejects oversized batches instead of truncating them', () => {
    for (const lines of [['a'.repeat(150001)]])
      expect(() =>
        validateTranscript({ pages: [{ page: 1, lines }] }, 1),
      ).toThrow('exceeds');
  });
});

describe('selective PDF evidence and provider blocks', () => {
  const facts = [
    'Vehicle Atlas, model year 2026',
    'Configuration | Base | Sport',
    'Torque | 400 Nm | 450 Nm',
    'Engine | 2.0 L | 3.0 L',
    'Availability: x means optional; confirm each column and footnote.',
  ];
  it('rejects a RECITATION partial object immediately and exposes only safe diagnostics', async () => {
    const usage = { inputTokens: 500, outputTokens: 123 };
    generate.mockResolvedValue({
      text: 'private provider text',
      object: { pages: [{ page: 1, lines: facts }] },
      finishReason: 'other',
      usage,
      steps: [
        {
          response: {
            body: {
              choices: [
                {
                  finish_reason: 'error',
                  native_finish_reason: 'RECITATION',
                  message: {
                    content: 'private copyrighted paragraph',
                    reasoning: 'private reasoning',
                  },
                },
              ],
              provider: 'private-provider-metadata',
            },
          },
        },
      ],
    });
    const onUsage = vi.fn();
    const error = await transcribePdf(
      onePagePdf(),
      1,
      new AbortController().signal,
      onUsage,
    ).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain('native finish reason: RECITATION');
    expect(message).toContain('output tokens: 123');
    expect(message).not.toMatch(/private|Atlas|400/);
    expect(generate).toHaveBeenCalledOnce();
    expect(onUsage).toHaveBeenCalledWith(usage);
  });

  it('honors native blocks even if the normalized finish reason says stop', async () => {
    generate.mockResolvedValue({
      object: { pages: [{ page: 1, lines: facts }] },
      finishReason: 'stop',
      response: { body: { choices: [{ native_finish_reason: 'SAFETY' }] } },
    });
    await expect(
      transcribePdf(onePagePdf(), 1, new AbortController().signal),
    ).rejects.toThrow('native finish reason: SAFETY');
    expect(generate).toHaveBeenCalledOnce();
  });

  it('retries native MAX_TOKENS despite normalized stop and accepts only the later complete result', async () => {
    generate
      .mockResolvedValueOnce({
        finishReason: 'stop',
        object: {
          pages: [
            {
              page: 1,
              lines: [...facts, 'Incomplete output must not survive'],
            },
          ],
        },
        response: {
          body: { choices: [{ native_finish_reason: 'MAX_TOKENS' }] },
        },
      })
      .mockResolvedValueOnce({
        finishReason: 'stop',
        object: { pages: [{ page: 1, lines: facts }] },
        response: { body: { choices: [{ native_finish_reason: 'STOP' }] } },
      });
    const result = await transcribePdf(
      onePagePdf(),
      1,
      new AbortController().signal,
    );
    expect(result.text).toBe(`Page 1\n${facts.join('\n')}`);
    expect(result.text).not.toContain('Incomplete output must not survive');
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('does not echo unrecognized provider diagnostic values or raw error payloads', async () => {
    generate.mockResolvedValue({
      text: 'private raw text',
      object: undefined,
      finishReason: 'private finish',
      usage: { outputTokens: 'private count' },
      steps: [
        {
          response: {
            body: {
              choices: [
                {
                  native_finish_reason: 'RECITATION private reason',
                  finish_reason: 'private choice',
                },
              ],
              error: { message: 'private error' },
            },
          },
        },
      ],
    });
    const error = await transcribePdf(
      onePagePdf(),
      1,
      new AbortController().signal,
    ).catch((error: unknown) => error);
    expect((error as Error).message).toContain('finish reason: unknown');
    expect((error as Error).message).not.toContain('private');
  });

  it('allows empty factual pages and batches before later specification evidence', async () => {
    generate.mockImplementation(async (messages) => {
      const firstPage = Number(
        messages[0].content[0].text.replace('Page ', ''),
      );
      return {
        finishReason: 'stop',
        object: {
          pages:
            firstPage === 1
              ? Array.from({ length: 4 }, (_, index) => ({
                  page: index + 1,
                  lines: [],
                }))
              : [{ page: 5, lines: facts }],
        },
      };
    });
    const result = await transcribePdf(
      onePagePdf(5),
      5,
      new AbortController().signal,
    );
    expect(result.text).toBe(
      `Page 1\n\nPage 2\n\nPage 3\n\nPage 4\n\nPage 5\n${facts.join('\n')}`,
    );
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('rejects documents with no factual evidence even when every page entry is present', async () => {
    generate.mockResolvedValue({
      finishReason: 'stop',
      object: { pages: [{ page: 1, lines: [] }] },
    });
    await expect(
      transcribePdf(onePagePdf(), 1, new AbortController().signal),
    ).rejects.toThrow('no sufficient vehicle evidence');
    expect(generate).toHaveBeenCalledOnce();
  });

  it('preserves cancellation returned during a model call without accepting its partial evidence', async () => {
    const controller = new AbortController();
    generate.mockImplementation(async () => {
      controller.abort(new Error('lease lost'));
      return {
        finishReason: 'stop',
        object: { pages: [{ page: 1, lines: facts }] },
      };
    });
    await expect(
      transcribePdf(onePagePdf(), 1, controller.signal),
    ).rejects.toThrow('lease lost');
    expect(generate).toHaveBeenCalledOnce();
  });
});
