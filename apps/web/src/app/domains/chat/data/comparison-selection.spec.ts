import type { Message } from '@ag-ui/client';

import type { Comparison } from '../../vehicles/api/contracts';
import { comparisonSelection } from './comparison-selection';

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
describe('comparison context restoration', () => {
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
});
