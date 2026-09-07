import type {
  IngestionClaim,
  IngestionConfigurationDraft,
} from '../data/ingestion-contracts';
import {
  claimCounts,
  claimGroups,
  currentValue,
  defaultSelection,
  filterGroups,
  runStage,
  toggleSelection,
} from './ingestion-presentation';

const claim = (overrides: Partial<IngestionClaim>): IngestionClaim => ({
  attributeCode: 'torque_max',
  label: 'Torque',
  unit: 'Nm',
  rawValue: '60',
  rawUnit: 'kgf.m',
  availability: null,
  listValue: null,
  qualifiers: {},
  lineStart: 1,
  lineEnd: 1,
  excerpt: '60 kgf.m',
  locator: 'Page 1',
  value: 588.399,
  issues: [],
  ...overrides,
});
const configuration: IngestionConfigurationDraft = {
  name: 'Limited',
  identityLineStart: 1,
  identityLineEnd: 1,
  identityExcerpt: 'Limited',
  warnings: [],
  claims: [
    claim({}),
    claim({ rawValue: '61', value: 598.2 }),
    claim({
      attributeCode: 'camera_360',
      label: 'Camera',
      unit: null,
      rawValue: 'S',
      rawUnit: null,
      availability: 'STANDARD',
      value: null,
    }),
    claim({
      attributeCode: 'payload',
      label: 'Payload',
      unit: 'kg',
      rawValue: '—',
      value: null,
      issues: ['Ambiguous source value'],
    }),
  ],
};
const current = {
  camera_360: {
    knowledge_status: 'KNOWN',
    value: null,
    availability: 'STANDARD',
    qualifiers: {},
  },
};

describe('ingestion presentation', () => {
  it('groups claims per attribute and flags conflicting candidates', () => {
    const groups = claimGroups(configuration, current);
    expect(groups.map((group) => group.attributeCode)).toEqual([
      'torque_max',
      'camera_360',
      'payload',
    ]);
    expect(groups[0].conflicting).toBe(true);
    expect(groups[0].rows.map((row) => row.change)).toEqual(['new', 'new']);
    expect(groups[1].rows[0].change).toBe('same');
    expect(groups[2].rows[0].change).toBe('invalid');
    expect(groups[0].rows[0].proposed).toBe('588.399 Nm');
    expect(groups[0].rows[0].raw).toBe('60 kgf.m');
    expect(claimCounts(groups)).toEqual({
      total: 4,
      valid: 3,
      issues: 1,
      conflicts: 1,
      changes: 2,
    });
  });
  it('filters by change, conflict and issue', () => {
    const groups = claimGroups(configuration, current);
    expect(filterGroups(groups, 'issues').flatMap((g) => g.rows).length).toBe(
      1,
    );
    expect(filterGroups(groups, 'conflicts').length).toBe(1);
    expect(filterGroups(groups, 'changes').flatMap((g) => g.rows).length).toBe(
      2,
    );
  });
  it('preselects unambiguous changes and keeps one candidate per attribute', () => {
    const groups = claimGroups(configuration, current);
    expect(defaultSelection(groups, 4)).toEqual([false, false, false, false]);
    const first = toggleSelection([false, false, false, false], groups, 0);
    expect(first).toEqual([true, false, false, false]);
    const second = toggleSelection(first, groups, 1);
    expect(second).toEqual([false, true, false, false]);
    expect(toggleSelection(second, groups, 1)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
  it('describes current catalog cells and run stages', () => {
    expect(currentValue(undefined, 'Nm')).toBe('Not in catalog');
    expect(
      currentValue(
        {
          knowledge_status: 'NOT_REPORTED',
          value: null,
          availability: null,
          qualifiers: null,
        },
        'Nm',
      ),
    ).toBe('Not reported');
    expect(
      currentValue(
        {
          knowledge_status: 'KNOWN',
          value: 600,
          availability: null,
          qualifiers: null,
        },
        'Nm',
      ),
    ).toBe('600 Nm');
    expect(runStage('PROCESSING').step).toBe(1);
    expect(runStage('FAILED')).toMatchObject({ step: -1, terminal: true });
  });
});
