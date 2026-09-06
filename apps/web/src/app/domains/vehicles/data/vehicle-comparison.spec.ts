import { safeSourceUrl } from '../util/vehicle-display';
import { cellObservations, comparisonRows } from './vehicle-comparison';
import type { Comparison } from './vehicle-contracts';

const id = '08e08761-a2e7-5ae5-b2ad-387e93829fb7';
const second = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1';
const configuration = {
  id,
  brand: 'Ford',
  model: 'Ranger',
  name: 'Black',
  market: 'BR',
  modelYear: 2026,
  identityStatus: 'PROVISIONAL',
  identityNote: null,
  identityEvidenceId: null,
};
const attribute = {
  id,
  code: 'camera_360',
  label: 'Camera',
  description: null,
  valueType: 'AVAILABILITY' as const,
  unit: null,
};
const observation = {
  id,
  value: null,
  availability: 'OPTIONAL' as const,
  qualifiers: { package: 'Tech' },
  rawValue: null,
  reviewStatus: 'ACCEPTED',
  evidence: [],
};
const cell = {
  configurationId: id,
  knowledgeStatus: 'KNOWN' as const,
  reason: null,
  selectedObservationId: id,
  observations: [observation],
};
const matrix: Comparison = {
  configurations: [
    configuration,
    { ...configuration, id: second, name: 'Limited' },
  ],
  rows: [{ attribute, cells: [cell, { ...cell, configurationId: second }] }],
};
describe('comparison semantics', () => {
  it('hides equal facts but retains missing and conflicting cells', () => {
    expect(comparisonRows(matrix, true)).toHaveLength(0);
    const conflict = {
      ...matrix,
      rows: [
        {
          attribute,
          cells: [
            cell,
            {
              ...cell,
              knowledgeStatus: 'CONFLICTING' as const,
              selectedObservationId: null,
            },
          ],
        },
      ],
    };
    expect(comparisonRows(conflict, true)).toHaveLength(1);
  });
  it('does not expose unselected claims as accepted values', () => {
    expect(
      cellObservations({ ...cell, selectedObservationId: second }),
    ).toEqual([]);
    expect(
      cellObservations({ ...cell, knowledgeStatus: 'NOT_REPORTED' }),
    ).toEqual([]);
  });
  it('rejects executable source URLs', () => {
    expect(safeSourceUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeSourceUrl('https://example.com/review')).toBe(
      'https://example.com/review',
    );
  });
});
