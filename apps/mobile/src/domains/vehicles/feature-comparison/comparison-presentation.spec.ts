import type { Comparison } from '../data/vehicle-contracts';
import {
  availabilityLabel,
  cellSummary,
  differingAttributeIds,
  filterRows,
  hasDetails,
  hiddenRowsLabel,
  observationValue,
  qualifierLabels,
  rowCounts,
} from './comparison-presentation';

const black = '08e08761-a2e7-5ae5-b2ad-387e93829fb7';
const limited = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1';
const configuration = {
  id: black,
  brand: 'Ford',
  model: 'Ranger',
  name: 'Black',
  market: 'BR',
  modelYear: 2026,
  identityStatus: 'CONFIRMED',
  identityNote: null,
  identityEvidenceId: null,
};

function observation(
  id: string,
  value: number | null,
  availability: 'OPTIONAL' | 'ABSENT' | null = null,
  qualifiers: Record<string, unknown> = {},
) {
  return {
    id,
    value,
    availability,
    qualifiers,
    rawValue: null,
    reviewStatus: 'ACCEPTED',
    evidence: [],
  };
}

function attribute(
  id: string,
  code: string,
  label: string,
  unit: string | null,
) {
  return {
    id,
    code,
    label,
    description: null,
    valueType: 'NUMBER' as const,
    unit,
  };
}

const comparison: Comparison = {
  configurations: [
    configuration,
    { ...configuration, id: limited, name: 'Limited' },
  ],
  rows: [
    {
      attribute: attribute(black, 'power_max', 'Maximum power', 'cv'),
      // Cells arrive out of order; each vehicle keeps its own value.
      cells: [
        {
          configurationId: limited,
          knowledgeStatus: 'KNOWN',
          reason: null,
          selectedObservationId: limited,
          observations: [observation(limited, 250, null, { rpm: 3250 })],
        },
        {
          configurationId: black,
          knowledgeStatus: 'KNOWN',
          reason: null,
          selectedObservationId: black,
          observations: [observation(black, 170)],
        },
      ],
    },
    {
      attribute: attribute(limited, 'camera_360', '360 camera', null),
      cells: [
        {
          configurationId: black,
          knowledgeStatus: 'KNOWN',
          reason: null,
          selectedObservationId: black,
          observations: [observation(black, null, 'OPTIONAL')],
        },
        {
          configurationId: limited,
          knowledgeStatus: 'KNOWN',
          reason: null,
          selectedObservationId: limited,
          observations: [observation(limited, null, 'OPTIONAL')],
        },
      ],
    },
  ],
};

const [power, camera] = comparison.rows as [
  Comparison['rows'][number],
  Comparison['rows'][number],
];

describe('comparison presentation', () => {
  it('pairs every vehicle with its own value, availability or gap', () => {
    expect(cellSummary(power, black)).toEqual({
      text: '170 cv',
      tone: 'value',
    });
    expect(cellSummary(power, limited)).toEqual({
      text: '250 cv',
      tone: 'value',
    });
    expect(cellSummary(camera, black)).toEqual({
      text: 'Optional',
      tone: 'availability',
    });
    expect(cellSummary(camera, 'missing')).toEqual({
      text: '—',
      tone: 'muted',
    });
  });

  it('filters by label or code and narrows to the differences', () => {
    expect(
      filterRows(comparison, false, 'CAMERA').map(
        ({ attribute }) => attribute.code,
      ),
    ).toEqual(['camera_360']);
    expect(filterRows(comparison, false, 'power_max')).toHaveLength(1);
    expect(
      filterRows(comparison, true, '').map(({ attribute }) => attribute.code),
    ).toEqual(['power_max']);
    expect([...differingAttributeIds(comparison)]).toEqual([black]);
  });

  it('offers sources only when a row carries qualifiers, evidence or unknowns', () => {
    expect(hasDetails(power)).toBe(true);
    expect(hasDetails(camera)).toBe(false);
  });

  it('reads qualifiers and observations in words', () => {
    expect(
      qualifierLabels({ rpm: 3250, stop_and_go: true, custom_key: 'x' }),
    ).toEqual([
      'Engine speed (rpm): 3250',
      'Stop and go: Yes',
      'custom key: x',
    ]);
    expect(qualifierLabels({ package_id: 'abc' })).toEqual([
      'Tied to an optional package. Check the conditions in the source.',
    ]);
    expect(observationValue(observation(black, 170, 'OPTIONAL'), power)).toBe(
      '170 cv · Optional',
    );
    expect(availabilityLabel('ABSENT')).toBe('Not available');
    expect(availabilityLabel(null)).toBe('');
  });
  it('hides attributes no vehicle reports and says how many', () => {
    const unreported = {
      attribute: attribute(
        '00000000-0000-4000-8000-000000000099',
        'ground_clearance',
        'Ground clearance',
        'mm',
      ),
      cells: [black, limited].map((configurationId) => ({
        configurationId,
        knowledgeStatus: 'NOT_REPORTED' as const,
        reason: null,
        selectedObservationId: null,
        observations: [],
      })),
    };
    const sparse = { ...comparison, rows: [...comparison.rows, unreported] };
    expect(filterRows(sparse, false, '').map((r) => r.attribute.code)).toEqual([
      'power_max',
      'camera_360',
    ]);
    expect(rowCounts(sparse)).toEqual({ reported: 2, hidden: 1 });
    expect(hiddenRowsLabel(1)).toBe(
      'one item without data for any vehicle is hidden',
    );
    expect(hiddenRowsLabel(3)).toBe(
      '3 items without data for any vehicle are hidden',
    );
    expect(hiddenRowsLabel(0)).toBe('');
  });
});
