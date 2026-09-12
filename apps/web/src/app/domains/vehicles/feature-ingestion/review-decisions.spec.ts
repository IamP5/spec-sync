import type {
  IngestionClaim,
  IngestionConfigurationDraft,
  IngestionCurrentCell,
} from '../data/ingestion-contracts';
import {
  canPublish,
  carryOverDecisions,
  chooseCandidate,
  clearChoice,
  decisionCounts,
  decisionStatus,
  deferDecision,
  initialDecisions,
  nextPending,
  publishedClaims,
  reviewDecisions,
  reviewPayload,
} from './review-decisions';

function claim(overrides: Partial<IngestionClaim>): IngestionClaim {
  return {
    attributeCode: 'torque_max',
    label: 'Torque',
    unit: 'Nm',
    rawValue: '60',
    rawUnit: 'kgf.m',
    availability: null,
    listValue: null,
    qualifiers: {},
    lineStart: 2,
    lineEnd: 2,
    excerpt: '60 kgf.m',
    locator: 'Page 1',
    value: 588.4,
    issues: [],
    ...overrides,
  };
}
const known = (value: unknown): IngestionCurrentCell => ({
  knowledge_status: 'KNOWN',
  value,
  availability: null,
  qualifiers: {},
});
/**
 * 0 torque (changed, alone) · 1/2 power (two evidenced candidates) ·
 * 3 payload (unverified) · 4 length (same as catalog)
 */
const configuration: IngestionConfigurationDraft = {
  name: 'Limited',
  identityLineStart: 1,
  identityLineEnd: 1,
  identityExcerpt: 'Ranger 2026',
  warnings: [],
  claims: [
    claim({}),
    claim({
      attributeCode: 'power',
      label: 'Power',
      rawValue: '250',
      value: 250,
    }),
    claim({
      attributeCode: 'power',
      label: 'Power',
      rawValue: '254',
      value: 254,
    }),
    claim({
      attributeCode: 'payload',
      label: 'Payload',
      rawValue: '—',
      value: null,
      issues: ['lines 4-4 do not contain "—"'],
    }),
    claim({
      attributeCode: 'length',
      label: 'Length',
      rawValue: '5370',
      value: 5370,
    }),
  ],
};
const current = { torque_max: known(500), length: known(5370) };

describe('guided review decisions', () => {
  it('pre-approves the single evidenced candidate and leaves conflicts and unverified evidence to the reviewer', () => {
    const decisions = reviewDecisions(configuration, current);
    expect(decisions.map((d) => [d.attributeCode, d.kind])).toEqual([
      ['torque_max', 'auto'],
      ['power', 'conflict'],
      ['payload', 'unverified'],
      ['length', 'same'],
    ]);
    const state = initialDecisions(decisions);
    expect(state.selected).toEqual({ torque_max: 0 });
    expect(decisions.map((d) => decisionStatus(d, state))).toEqual([
      'selected',
      'pending',
      'pending',
      'same',
    ]);
    expect(decisionCounts(decisions, state)).toEqual({
      total: 4,
      pending: 2,
      selected: 1,
      published: 0,
      deferred: 0,
    });
  });

  it('keeps one candidate per attribute and lets the reviewer set a decision aside', () => {
    const decisions = reviewDecisions(configuration, current);
    const power = decisions[1];
    let state = chooseCandidate(initialDecisions(decisions), power, 2);
    expect(state.selected).toEqual({ torque_max: 0, power: 2 });
    state = chooseCandidate(state, power, 1);
    expect(state.selected['power']).toBe(1);
    expect(chooseCandidate(state, decisions[2], 3).selected).toEqual(
      state.selected,
    );
    state = deferDecision(state, 'power');
    expect(state.selected).toEqual({ torque_max: 0 });
    expect(decisionStatus(power, state)).toBe('deferred');
    state = chooseCandidate(state, power, 1);
    expect(state.deferred).toEqual([]);
    expect(clearChoice(state, 'torque_max').selected).toEqual({ power: 1 });
  });

  it('walks the open decisions in order, wrapping around, until none is left', () => {
    const decisions = reviewDecisions(configuration, current);
    const state = initialDecisions(decisions);
    expect(nextPending(decisions, state, undefined)?.attributeCode).toBe(
      'power',
    );
    expect(nextPending(decisions, state, 'power')?.attributeCode).toBe(
      'payload',
    );
    expect(nextPending(decisions, state, 'payload')?.attributeCode).toBe(
      'power',
    );
    const done = deferDecision(
      chooseCandidate(state, decisions[1], 1),
      'payload',
    );
    expect(nextPending(decisions, done, 'torque_max')).toBeUndefined();
  });

  it('treats what this run already published as final and carries the rest of the choices over', () => {
    const first = reviewDecisions(configuration, current);
    let state = chooseCandidate(initialDecisions(first), first[1], 2);
    state = deferDecision(state, 'payload');
    state = { ...state, identityConfirmed: true, reason: 'Trail only' };
    const published = publishedClaims([
      {
        draftHash: 'h',
        baseRevision: 1,
        reason: 'first',
        configurations: [
          { configuration: 0, identityConfirmed: true, selectedClaims: [0] },
        ],
      },
    ]);
    const after = reviewDecisions(configuration, current, published.get(0));
    expect(after[0]).toMatchObject({ kind: 'published' });
    expect(after[0].published?.index).toBe(0);
    const carried = carryOverDecisions(state, after);
    expect(carried.selected).toEqual({ power: 2 });
    expect(carried.deferred).toEqual(['payload']);
    expect(carried.identityConfirmed).toBe(true);
    expect(carried.reason).toBe('Trail only');
    expect(decisionStatus(after[0], carried)).toBe('published');
    expect(carryOverDecisions(undefined, after).selected).toEqual({});
  });

  it('builds the publication from the selection only, with an optional reason per configuration', () => {
    const decisions = reviewDecisions(configuration, current);
    const chosen = chooseCandidate(
      initialDecisions(decisions),
      decisions[1],
      2,
    );
    const model = {
      reason: ' Checked the brochure ',
      configurations: [
        { ...chosen, identityConfirmed: true, reason: ' Limited page ' },
        { ...initialDecisions([]), identityConfirmed: false },
      ],
    };
    expect(canPublish(model)).toBe(true);
    expect(reviewPayload({ draftHash: 'h', baseRevision: 7 }, model)).toEqual({
      draftHash: 'h',
      baseRevision: 7,
      reason: 'Checked the brochure',
      configurations: [
        {
          configuration: 0,
          identityConfirmed: true,
          selectedClaims: [0, 2],
          reason: 'Limited page',
        },
      ],
    });
    expect(
      canPublish({
        ...model,
        configurations: [
          { ...model.configurations[0], identityConfirmed: false },
        ],
      }),
    ).toBe(false);
    expect(canPublish({ ...model, reason: '  ' })).toBe(false);
    expect(
      canPublish({ ...model, configurations: [initialDecisions([])] }),
    ).toBe(false);
  });
});
