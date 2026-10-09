import { reviewRun } from '../../../testing/research-fixtures';
import type { IngestionRun } from '../data/ingestion-contracts';
import { chooseCandidate } from './review-decisions';
import {
  filterDecisions,
  modelRevision,
  preApprovedCount,
  publicationBatches,
  reconcileModel,
  runConfigurations,
  runDecisions,
  updateConfiguration,
} from './review-model';

/** A run whose Limited power claim is evidenced (no issues), XLT unverified. */
function evidencedRun(overrides: Partial<IngestionRun> = {}): IngestionRun {
  const run = reviewRun(overrides);
  const draft = run.draft!;
  return {
    ...run,
    draft: {
      ...draft,
      configurations: draft.configurations.map((configuration, index) =>
        index === 0
          ? {
              ...configuration,
              claims: configuration.claims.map((claim) => ({
                ...claim,
                issues: [],
              })),
            }
          : configuration,
      ),
    },
  };
}

describe('guided review model', () => {
  it('pre-approves the evidenced candidate per configuration', () => {
    const run = evidencedRun();
    const decisions = runDecisions(run, 'en-US');
    expect(decisions.map((items) => items.map((d) => d.kind))).toEqual([
      ['auto'],
      ['unverified'],
    ]);
    const { model } = reconcileModel(undefined, modelRevision(run), decisions);
    expect(model.configurations.map((state) => state.selected)).toEqual([
      { power: 0 },
      {},
    ]);
    expect(preApprovedCount(decisions, model)).toBe(1);
    expect(
      filterDecisions(decisions[1]!, model.configurations[1]!, 'pending'),
    ).toHaveLength(1);
    expect(
      publicationBatches(runConfigurations(run), decisions, model),
    ).toEqual([
      {
        index: 0,
        name: 'Limited',
        state: model.configurations[0],
        items: [{ label: 'Power', proposed: '250 cv' }],
      },
    ]);
  });

  it('keeps the choices over a new revision of the same draft and resets them for another draft', () => {
    const run = evidencedRun();
    const decisions = runDecisions(run, 'en-US');
    const first = reconcileModel(undefined, modelRevision(run), decisions);
    const edited = {
      ...first,
      model: updateConfiguration(
        { ...first.model, reason: 'Checked the brochure' },
        0,
        (state) => ({ ...state, identityConfirmed: true }),
      ),
    };
    const published = evidencedRun({
      baseRevision: 5,
      decisions: [
        {
          draftHash: run.draftHash!,
          baseRevision: 4,
          reason: 'first',
          configurations: [
            { configuration: 0, identityConfirmed: true, selectedClaims: [0] },
          ],
        },
      ],
    });
    const after = runDecisions(published, 'en-US');
    const carried = reconcileModel(edited, modelRevision(published), after);
    expect(after[0]![0]!.kind).toBe('published');
    expect(carried.model.reason).toBe('Checked the brochure');
    expect(carried.model.configurations[0]).toMatchObject({
      identityConfirmed: true,
      selected: {},
    });
    const other = reconcileModel(
      edited,
      modelRevision({ ...run, draftHash: 'd'.repeat(64) }),
      decisions,
    );
    expect(other.model.reason).toBe('');
    expect(other.model.configurations[0]!.identityConfirmed).toBe(false);
  });

  it('never selects an unverified candidate', () => {
    const run = reviewRun();
    const decisions = runDecisions(run, 'en-US');
    const { model } = reconcileModel(undefined, modelRevision(run), decisions);
    const state = chooseCandidate(
      model.configurations[0]!,
      decisions[0]![0]!,
      0,
    );
    expect(state.selected).toEqual({});
  });
});
