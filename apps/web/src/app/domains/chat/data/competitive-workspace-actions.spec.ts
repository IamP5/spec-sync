import { competitiveWorkspaceFixture } from '../../../testing/competitive-workspace-fixtures';
import {
  workspaceActionSchema,
  workspaceActionSummary,
} from './competitive-workspace-actions';

describe('workspace action contract', () => {
  const action = {
    version: 1,
    actionId: '59a65285-b6e6-44e7-981b-bddf1b7a6239',
    surfaceId: competitiveWorkspaceFixture().surfaceId,
    expectedRevision: 1,
    componentId: 'brief',
    action: 'applyBrief',
    values: competitiveWorkspaceFixture().snapshot.plan.context,
  };
  it('requires an explicit version, revision, component and discriminated values', () => {
    expect(workspaceActionSchema.safeParse(action).success).toBe(true);
    for (const change of [
      { version: 2 },
      { expectedRevision: 0 },
      { componentId: 'unknown' },
      { values: { prompt: 'Do anything' } },
      { action: 'executeCode' },
      { extra: 'ignored' },
    ])
      expect(
        workspaceActionSchema.safeParse({ ...action, ...change }).success,
      ).toBe(false);
  });
  it('rejects non-finite scenario targets and undeclared retry payloads', () => {
    expect(
      workspaceActionSchema.safeParse({
        ...action,
        componentId: 'scenario',
        action: 'applyScenario',
        values: { attributeCode: 'power_kw', targetValue: Infinity },
      }).success,
    ).toBe(false);
    expect(
      workspaceActionSchema.safeParse({
        ...action,
        componentId: 'comparison',
        action: 'retryPanel',
        values: { url: 'https://example.com' },
      }).success,
    ).toBe(false);
  });
  it('records a readable summary without using it to recover action intent', () => {
    const parsed = workspaceActionSchema.parse(action);
    expect(workspaceActionSummary(parsed)).toContain(action.values.objective);
  });
});
