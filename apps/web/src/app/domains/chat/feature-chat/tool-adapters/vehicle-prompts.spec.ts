import { catalogPagePrompt, vehicleQuestionPrompt } from './vehicle-prompts';

describe('vehicle question prompts', () => {
  it('uses only stable IDs for selected evidence', () => {
    const prompt = vehicleQuestionPrompt({
      kind: 'reviews',
      attributeCode: 'camera_360',
      configurationIds: ['black'],
      evidenceIds: ['evidence-id'],
      observationIds: ['observation-id'],
    });
    expect(prompt).toContain('evidence-id');
    expect(prompt).toContain('observation-id');
    expect(prompt).toContain('black');
    expect(prompt).toContain('camera_360');
  });

  it('asks for the next catalog page with the original search scope', () => {
    const prompt = catalogPagePrompt(
      { kind: 'catalog-page', offset: 20, limit: 20 },
      { q: '', market: 'BR', modelYear: 2026, limit: 20, offset: 0 },
    );
    expect(prompt).toContain('from offset 20');
    expect(prompt).toContain('up to 20 configurations');
    expect(prompt).toContain('market "BR"');
    expect(prompt).toContain('modelYear 2026');
    expect(prompt).not.toContain('q ""');
    expect(
      vehicleQuestionPrompt({ kind: 'catalog-page', offset: 3, limit: 3 }),
    ).not.toContain('keeping the same search');
  });
});
