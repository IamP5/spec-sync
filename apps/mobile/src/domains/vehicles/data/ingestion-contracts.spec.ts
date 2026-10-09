import { reviewRun } from '../../../testing/research-fixtures';
import {
  ingestionStartArgsSchema,
  parseIngestion,
  sourcePreviewSchema,
} from './ingestion-contracts';

describe('ingestion contracts', () => {
  it('parses the review run the research review endpoint wraps in `result`', () => {
    const run = reviewRun();
    const { decisions: _decisions, ...legacy } = run;
    const parsed = parseIngestion({ result: legacy });
    expect(parsed.draftHash).toBe(run.draftHash);
    expect(parsed.draft?.configurations.map((c) => c.name)).toEqual([
      'Limited',
      'XLT',
    ]);
    // Runs recorded before partial publications carry no decisions.
    expect(parsed.decisions).toEqual([]);
  });

  it('rejects an unwrapped or malformed run', () => {
    expect(() => parseIngestion(reviewRun())).toThrow();
    expect(() =>
      parseIngestion({ result: { ...reviewRun(), id: 'not-a-uuid' } }),
    ).toThrow();
  });

  it('validates the source preview contract with the AI service', () => {
    const preview = {
      status: 'OK',
      source: {
        url: 'https://www.ford.com.br/ranger.pdf',
        title: 'ranger.pdf',
        mimeType: 'application/pdf',
        pageCount: 6,
      },
      configurations: [
        {
          name: 'XLT 2.0',
          powertrain: null,
          column: 'XLT',
          locator: 'Page 3',
          excerpt: 'XLT',
        },
      ],
      legend: [],
      modelYearNote: null,
      notes: [],
      message: 'The source presents 1 configuration(s).',
    };
    expect(sourcePreviewSchema.safeParse(preview).success).toBe(true);
    expect(
      sourcePreviewSchema.safeParse({ ...preview, status: 'ERROR' }).success,
    ).toBe(false);
  });

  it('coerces a model year the model sent as a string', () => {
    expect(
      ingestionStartArgsSchema.parse({
        sourceUrl: 'https://example.com/a.pdf',
        brand: 'Ford',
        model: 'Ranger',
        modelYear: '2026',
      }),
    ).toEqual({
      sourceUrl: 'https://example.com/a.pdf',
      brand: 'Ford',
      model: 'Ranger',
      modelYear: 2026,
      configurations: [],
    });
  });
});
