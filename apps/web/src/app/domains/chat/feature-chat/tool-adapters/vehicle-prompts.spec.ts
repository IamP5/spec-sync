import { vehicleQuestionPrompt } from './vehicle-prompts';

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
});
