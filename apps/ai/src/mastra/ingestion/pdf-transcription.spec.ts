import { describe, expect, it } from 'vitest';

import { validateTranscript } from './pdf-transcription';

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
  it('rejects empty or oversized transcripts instead of truncating them', () => {
    for (const lines of [[], ['a'.repeat(150001)]])
      expect(() =>
        validateTranscript({ pages: [{ page: 1, lines }] }, 1),
      ).toThrow('empty or exceeds');
  });
});
