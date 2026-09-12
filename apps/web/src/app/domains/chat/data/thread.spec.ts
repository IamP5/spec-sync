import {
  groupThreads,
  matchesQuery,
  parseResearchUpdates,
  threadTitleOf,
} from './thread';

const DAY = 24 * 60 * 60 * 1000;

function thread(id: string, updatedAt: number, title = id) {
  return { id, title, createdAt: updatedAt, updatedAt };
}

describe('parseResearchUpdates', () => {
  it('reads the messages and whether a research is still running', () => {
    const message = { id: 'research-ready-1', role: 'assistant', content: 'x' };
    expect(
      parseResearchUpdates({ id: 't', messages: [message], pending: false }),
    ).toEqual({ messages: [message], pending: false });
  });

  it('keeps asking a service that does not say whether more may follow', () => {
    expect(parseResearchUpdates({ messages: [] })).toEqual({
      messages: [],
      pending: true,
    });
  });
});

describe('threadTitleOf', () => {
  it('takes the first non-empty line without Markdown markers', () => {
    expect(threadTitleOf('\n## Reset **password**\nmore')).toBe(
      'Reset **password**',
    );
    expect(threadTitleOf('- list item')).toBe('list item');
  });

  it('cuts long titles with an ellipsis', () => {
    const title = threadTitleOf('a'.repeat(100));
    expect(title).toHaveLength(48);
    expect(title.endsWith('…')).toBe(true);
  });

  it('falls back to a default for blank text', () => {
    expect(threadTitleOf('   ')).toBe('New chat');
  });
});

describe('groupThreads', () => {
  const now = new Date(2026, 8, 5, 15, 0).getTime();

  it('sections by day, newest first, and drops empty sections', () => {
    const groups = groupThreads(
      [
        thread('old', now - 40 * DAY),
        thread('today-early', now - 2 * 60 * 60 * 1000),
        thread('yesterday', now - DAY),
        thread('today-late', now - 60 * 1000),
        thread('last-week', now - 3 * DAY),
      ],
      now,
    );

    expect(
      groups.map((group) => [group.label, group.threads.map((t) => t.id)]),
    ).toEqual([
      ['Today', ['today-late', 'today-early']],
      ['Yesterday', ['yesterday']],
      ['Previous 7 days', ['last-week']],
      ['Older', ['old']],
    ]);
  });

  it('returns no sections without threads', () => {
    expect(groupThreads([], now)).toEqual([]);
  });
});

describe('matchesQuery', () => {
  it('matches case-insensitively and treats a blank query as a match', () => {
    const t = thread('1', 0, 'Password reset');
    expect(matchesQuery(t, 'RESET')).toBe(true);
    expect(matchesQuery(t, '  ')).toBe(true);
    expect(matchesQuery(t, 'login')).toBe(false);
  });
});
