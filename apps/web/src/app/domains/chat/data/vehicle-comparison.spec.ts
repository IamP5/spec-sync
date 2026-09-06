import type { Message } from '@ag-ui/client';

import {
  cellObservations,
  comparisonRows,
  comparisonSelection,
  safeSourceUrl,
} from './vehicle-comparison';
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
function messages(result: unknown): Message[] {
  return [
    {
      id: 'assistant',
      role: 'assistant',
      toolCalls: [
        {
          id: 'call',
          type: 'function',
          function: { name: 'compareVehicleConfigurations', arguments: '{}' },
        },
      ],
    },
    {
      id: 'result',
      role: 'tool',
      toolCallId: 'call',
      content: JSON.stringify(result),
    },
  ];
}
describe('comparison state and presentation', () => {
  it('reconstructs selection from a stored successful result', () => {
    expect(comparisonSelection(messages(matrix))).toEqual({
      version: 1,
      configurationIds: [id, second],
      attributeCodes: ['camera_360'],
      lastComparisonToolCallId: 'call',
    });
  });
  it('does not overwrite a successful selection with a tool error', () => {
    expect(
      comparisonSelection([
        ...messages(matrix),
        ...messages({ status: 'ERROR' }),
      ])?.configurationIds,
    ).toEqual([id, second]);
  });
  it('does not interpret model prose as selection', () => {
    expect(
      comparisonSelection([
        { id: 'text', role: 'assistant', content: JSON.stringify(matrix) },
      ]),
    ).toBeUndefined();
  });
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
