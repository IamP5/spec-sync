import {
  competitiveWorkspaceFixture,
  competitiveWorkspaceMessages,
  reviseCompetitiveWorkspace,
} from '../../../testing/competitive-workspace-fixtures';
import { createCompetitiveSurfaceProjection } from './competitive-surface-views';

describe('competitive surface projection', () => {
  it('replays an explicit chain and preserves parsed identity across unrelated turns', () => {
    const project = createCompetitiveSurfaceProjection(),
      initial = competitiveWorkspaceFixture(),
      next = reviseCompetitiveWorkspace(initial, { title: 'Refined analysis' });
    const messages = [
      ...competitiveWorkspaceMessages(initial),
      ...competitiveWorkspaceMessages(next, 'update'),
    ];
    const latest = project(messages).get(initial.surfaceId)?.workspace;
    expect(latest?.revision).toBe(2);
    expect(
      project([
        ...messages,
        { id: 'text', role: 'assistant', content: 'A narrative update.' },
      ]).get(initial.surfaceId)?.workspace,
    ).toBe(latest);
    expect(messages[1].content).toBe(JSON.stringify(initial));
  });
  it('keeps the last valid snapshot for failed revisions, malformed results and explicit rejections', () => {
    const project = createCompetitiveSurfaceProjection(),
      initial = competitiveWorkspaceFixture();
    const failure = reviseCompetitiveWorkspace(
      initial,
      {},
      initial.snapshot.panels.map((panel) => ({
        ...panel,
        result: { status: 'ERROR', message: 'Unavailable', retryable: true },
      })),
    );
    const base = competitiveWorkspaceMessages(initial);
    expect(
      project([
        ...base,
        ...competitiveWorkspaceMessages(failure, 'failed'),
      ]).get(initial.surfaceId)?.workspace.revision,
    ).toBe(1);
    expect(
      project([
        ...base,
        ...competitiveWorkspaceMessages({ operations: [] }, 'malformed'),
      ]).get(initial.surfaceId)?.workspace.revision,
    ).toBe(1);
    const rejected = {
      status: 'REJECTED',
      code: 'STALE_REVISION',
      message: 'Workspace changed.',
      surfaceId: initial.surfaceId,
    };
    const view = project([
      ...base,
      ...competitiveWorkspaceMessages(rejected, 'rejected'),
    ]).get(initial.surfaceId);
    expect(view?.workspace.revision).toBe(1);
    expect(view?.notice).toBe('Workspace changed.');
  });
  it('rejects conflicting sibling revisions without choosing a winner', () => {
    const initial = competitiveWorkspaceFixture(),
      a = reviseCompetitiveWorkspace(initial, { title: 'Branch A' }),
      b = reviseCompetitiveWorkspace(initial, { title: 'Branch B' });
    const view = createCompetitiveSurfaceProjection()([
      ...competitiveWorkspaceMessages(initial),
      ...competitiveWorkspaceMessages(a, 'a'),
      ...competitiveWorkspaceMessages(b, 'b'),
    ]).get(initial.surfaceId);
    expect(view?.workspace.revision).toBe(1);
    expect(view?.conflicted).toBe(true);
  });
  it('does not bridge missing ancestors or reconstruct workspaces from other tools', () => {
    const initial = competitiveWorkspaceFixture(),
      orphan = competitiveWorkspaceFixture({}, 3);
    const project = createCompetitiveSurfaceProjection();
    const view = project([
      ...competitiveWorkspaceMessages(initial),
      ...competitiveWorkspaceMessages(orphan, 'orphan'),
    ]).get(initial.surfaceId);
    expect(view?.workspace.revision).toBe(1);
    expect(view?.conflicted).toBe(true);
    expect(project([competitiveWorkspaceMessages(initial)[1]]).size).toBe(0);
  });
  it('keeps separate surface identities independent and ignores repeated delivery of one invocation', () => {
    const a = competitiveWorkspaceFixture(),
      b = competitiveWorkspaceFixture(
        {},
        1,
        'competitive-f94a2350-0a1a-5ad3-aef8-3c0c472c72a1',
      );
    const messages = competitiveWorkspaceMessages(a);
    const views = createCompetitiveSurfaceProjection()([
      ...messages,
      messages[1],
      ...competitiveWorkspaceMessages(b, 'second'),
    ]);
    expect(views.size).toBe(2);
    expect(views.get(a.surfaceId)?.conflicted).toBe(false);
  });
  it('does not decode unchanged historical payloads on streaming updates and clears obsolete rejection notices', () => {
    const initial = competitiveWorkspaceFixture(),
      project = createCompetitiveSurfaceProjection(),
      messages = competitiveWorkspaceMessages(initial);
    project(messages);
    const parse = vi.spyOn(JSON, 'parse');
    project([
      ...messages,
      { id: 'stream', role: 'assistant', content: 'Token' },
    ]);
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
    const rejection = {
      status: 'REJECTED',
      code: 'STALE_REVISION',
      message: 'Old failure',
      surfaceId: initial.surfaceId,
    };
    const next = reviseCompetitiveWorkspace(initial);
    expect(
      project([
        ...messages,
        ...competitiveWorkspaceMessages(rejection, 'rejected'),
        ...competitiveWorkspaceMessages(next, 'next'),
      ]).get(initial.surfaceId)?.notice,
    ).toBeUndefined();
  });
});
