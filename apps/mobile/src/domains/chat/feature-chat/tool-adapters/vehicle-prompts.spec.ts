import {
  vehicleComparisonPrompt,
  vehicleQuestionPrompt,
} from './vehicle-prompts';

const ranger = {
  id: '08e08761-a2e7-5ae5-b2ad-387e93829fb7',
  brand: 'Ford',
  model: 'Ranger',
  name: 'Black',
  market: 'BR',
  modelYear: 2026,
  identityStatus: 'CONFIRMED',
  identityNote: null,
  identityEvidenceId: null,
};

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

  it('names exact configurations by ID', () => {
    expect(vehicleComparisonPrompt([ranger])).toContain(
      `Ford Ranger Black (${ranger.id})`,
    );
    expect(vehicleQuestionPrompt({ kind: 'vehicle', vehicle: ranger })).toBe(
      `Tell me more about Ford Ranger Black, BR 2026 (configuration ID ${ranger.id}). Preserve unknowns, conflicts, qualifiers, and evidence.`,
    );
    expect(
      vehicleQuestionPrompt({
        kind: 'comparison',
        configurations: [ranger],
        attributeCodes: ['power_max', 'torque_max'],
      }),
    ).toContain('differences in power_max, torque_max');
    expect(
      vehicleQuestionPrompt({
        kind: 'discover',
        configurations: [ranger],
        attributeLabel: 'Torque',
      }),
    ).toContain('about Torque for Ford Ranger Black, BR 2026');
  });
});
