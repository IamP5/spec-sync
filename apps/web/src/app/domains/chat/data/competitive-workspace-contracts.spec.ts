import {
  competitiveWorkspaceFixture,
  reviseCompetitiveWorkspace,
} from '../../../testing/competitive-workspace-fixtures';
import { competitiveWorkspaceSchema } from './competitive-workspace-contracts';

describe('competitive workspace contract', () => {
  it('accepts creation and complete self-contained revision snapshots', () => {
    const initial = competitiveWorkspaceFixture();
    expect(competitiveWorkspaceSchema.safeParse(initial).success).toBe(true);
    expect(
      competitiveWorkspaceSchema.safeParse(reviseCompetitiveWorkspace(initial))
        .success,
    ).toBe(true);
  });
  it.each([
    [
      'foreign catalog',
      (workspace: ReturnType<typeof competitiveWorkspaceFixture>) => {
        const op = workspace.operations[0];
        if ('createSurface' in op)
          op.createSurface.catalogId =
            'urn:foreign' as typeof op.createSurface.catalogId;
      },
    ],
    [
      'cycle',
      (workspace: ReturnType<typeof competitiveWorkspaceFixture>) => {
        const root = workspace.snapshot.components[0];
        if ('children' in root) root.children[0] = 'root';
      },
    ],
    [
      'cross-surface',
      (workspace: ReturnType<typeof competitiveWorkspaceFixture>) => {
        const op = workspace.operations[1];
        if ('updateComponents' in op)
          op.updateComponents.surfaceId =
            'competitive-f94a2350-0a1a-5ad3-aef8-3c0c472c72a1';
      },
    ],
    [
      'revision gap',
      (workspace: ReturnType<typeof competitiveWorkspaceFixture>) => {
        workspace.revision = 4;
      },
    ],
    [
      'missing operation',
      (workspace: ReturnType<typeof competitiveWorkspaceFixture>) => {
        workspace.operations.pop();
      },
    ],
    [
      'unknown component',
      (workspace: ReturnType<typeof competitiveWorkspaceFixture>) => {
        workspace.snapshot.components[1].component =
          'Execute' as 'AnalystBrief';
      },
    ],
    [
      'wrong binding',
      (workspace: ReturnType<typeof competitiveWorkspaceFixture>) => {
        const leaf = workspace.snapshot.components[2];
        if ('data' in leaf) leaf.data.path = '/brief';
      },
    ],
    [
      'wrong panel definition',
      (workspace: ReturnType<typeof competitiveWorkspaceFixture>) => {
        workspace.snapshot.panels[0].args = {
          id: 'other',
          title: 'Other',
          type: 'gaps',
        };
      },
    ],
    [
      'wrong aggregate status',
      (workspace: ReturnType<typeof competitiveWorkspaceFixture>) => {
        workspace.status = 'ERROR';
      },
    ],
  ])('rejects %s', (_, tamper) => {
    const workspace = competitiveWorkspaceFixture();
    tamper(workspace);
    expect(competitiveWorkspaceSchema.safeParse(workspace).success).toBe(false);
  });
  it('rejects undeclared root payload keys and duplicate panel IDs', () => {
    expect(
      competitiveWorkspaceSchema.safeParse({
        ...competitiveWorkspaceFixture(),
        html: '<script />',
      }).success,
    ).toBe(false);
    const workspace = competitiveWorkspaceFixture();
    workspace.snapshot.plan.panels[1].id = 'selection';
    expect(competitiveWorkspaceSchema.safeParse(workspace).success).toBe(false);
  });
});
