import type { Message } from '@ag-ui/core';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let verified: { uid: string; resourceId: string } | undefined = {
  uid: 'u-1',
  resourceId: 'user:u-1',
};

vi.mock('../identity', () => ({
  verifiedUserOf: () => Promise.resolve(verified),
  requireVerifiedUser: (_c: unknown, next: () => Promise<void>) => next(),
}));

const { chatThreadRoutes, requestedTitle } = await import('./routes');

interface StoredThread {
  id: string;
  title?: string;
  resourceId: string;
  createdAt: Date;
  updatedAt: Date;
}

const stored = new Map<string, StoredThread>();
const messages = new Map<string, MastraDBMessage[]>();

const memory = {
  listThreads: vi.fn(({ filter }: { filter?: { resourceId?: string } }) => ({
    threads: [...stored.values()].filter(
      (thread) => thread.resourceId === filter?.resourceId,
    ),
  })),
  getThreadById: vi.fn(({ threadId }: { threadId: string }) =>
    Promise.resolve(stored.get(threadId) ?? null),
  ),
  recall: vi.fn(({ threadId }: { threadId: string }) =>
    Promise.resolve({ messages: messages.get(threadId) ?? [] }),
  ),
  updateThread: vi.fn(({ id, title }: { id: string; title: string }) => {
    const thread = stored.get(id);
    if (!thread) throw new Error('missing');
    const updated = { ...thread, title };
    stored.set(id, updated);
    return Promise.resolve(updated);
  }),
  deleteThread: vi.fn((id: string) => {
    stored.delete(id);
    return Promise.resolve();
  }),
  saveThread: vi.fn(({ thread }: { thread: StoredThread }) => {
    stored.set(thread.id, thread);
    return Promise.resolve(thread);
  }),
  saveMessages: vi.fn(
    ({ messages: saved }: { messages: MastraDBMessage[] }) => {
      for (const message of saved) {
        const threadId = message.threadId ?? '';
        messages.set(threadId, [...(messages.get(threadId) ?? []), message]);
      }
      return Promise.resolve({ messages: saved });
    },
  ),
};

function route(path: string, method: string) {
  const found = chatThreadRoutes.find(
    (candidate) => candidate.path === path && candidate.method === method,
  );
  if (!found || !('handler' in found)) {
    throw new Error(`No ${method} ${path} route`);
  }
  return found.handler as (c: unknown) => Promise<Response>;
}

function context(params: Record<string, string> = {}, body?: unknown) {
  return {
    header: vi.fn(),
    req: {
      raw: { headers: new Headers() },
      param: (name: string) => params[name],
      json: () => Promise.resolve(body),
    },
    get: () => ({
      getAgentById: () => ({ getMemory: () => Promise.resolve(memory) }),
    }),
    json: (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    body: (value: null, status: number) => new Response(value, { status }),
  };
}

function seed(id: string, resourceId: string): void {
  stored.set(id, {
    id,
    title: `Thread ${id}`,
    resourceId,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-02T00:00:00.000Z'),
  });
}

describe('chat thread routes', () => {
  beforeEach(() => {
    stored.clear();
    messages.clear();
    verified = { uid: 'u-1', resourceId: 'user:u-1' };
  });

  it('refuses completion delivery for another account or an anonymous caller', async () => {
    seed('theirs-notification', 'user:u-2');
    const handler = route('/chat/threads/:threadId/research-updates', 'POST');
    expect(
      (await handler(context({ threadId: 'theirs-notification' }))).status,
    ).toBe(404);
    expect(memory.recall).not.toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'theirs-notification' }),
    );
    verified = undefined;
    expect(
      (await handler(context({ threadId: 'theirs-notification' }))).status,
    ).toBe(401);
  });

  it('lists only the threads of the signed-in user', async () => {
    seed('mine', 'user:u-1');
    seed('theirs', 'user:u-2');
    const response = await route('/chat/threads', 'GET')(context());
    await expect(response.json()).resolves.toEqual({
      threads: [
        {
          id: 'mine',
          title: 'Thread mine',
          createdAt: Date.parse('2026-09-01T00:00:00.000Z'),
          updatedAt: Date.parse('2026-09-02T00:00:00.000Z'),
        },
      ],
    });
  });

  it('returns a thread with its messages as AG-UI messages', async () => {
    seed('mine', 'user:u-1');
    messages.set('mine', [
      {
        id: 'm-1',
        role: 'user',
        createdAt: new Date(),
        threadId: 'mine',
        content: { format: 2, parts: [{ type: 'text', text: 'Hi' }] },
      },
    ]);
    const response = await route(
      '/chat/threads/:threadId',
      'GET',
    )(context({ threadId: 'mine' }));
    const body = (await response.json()) as { messages: Message[] };
    expect(body.messages).toEqual([{ id: 'm-1', role: 'user', content: 'Hi' }]);
  });

  it('hides another user thread behind a 404', async () => {
    seed('theirs', 'user:u-2');
    const response = await route(
      '/chat/threads/:threadId',
      'GET',
    )(context({ threadId: 'theirs' }));
    expect(response.status).toBe(404);
    expect(memory.recall).not.toHaveBeenCalledWith(
      expect.objectContaining({ threadId: 'theirs' }),
    );
  });

  it('refuses to rename another user thread', async () => {
    seed('theirs', 'user:u-2');
    const response = await route(
      '/chat/threads/:threadId',
      'PATCH',
    )(context({ threadId: 'theirs' }, { title: 'Mine now' }));
    expect(response.status).toBe(404);
    expect(stored.get('theirs')?.title).toBe('Thread theirs');
  });

  it('renames an own thread', async () => {
    seed('mine', 'user:u-1');
    const response = await route(
      '/chat/threads/:threadId',
      'PATCH',
    )(context({ threadId: 'mine' }, { title: '  Ranger vs Hilux  ' }));
    expect(response.status).toBe(200);
    expect(stored.get('mine')?.title).toBe('Ranger vs Hilux');
  });

  it('rejects an empty rename', async () => {
    seed('mine', 'user:u-1');
    const response = await route(
      '/chat/threads/:threadId',
      'PATCH',
    )(context({ threadId: 'mine' }, { title: '   ' }));
    expect(response.status).toBe(400);
  });

  it('refuses to delete another user thread', async () => {
    seed('theirs', 'user:u-2');
    const response = await route(
      '/chat/threads/:threadId',
      'DELETE',
    )(context({ threadId: 'theirs' }));
    expect(response.status).toBe(404);
    expect(stored.has('theirs')).toBe(true);
  });

  it('deletes only the threads of the signed-in user', async () => {
    seed('mine', 'user:u-1');
    seed('theirs', 'user:u-2');
    const response = await route('/chat/threads', 'DELETE')(context());
    expect(response.status).toBe(204);
    expect([...stored.keys()]).toEqual(['theirs']);
  });
});

describe('request parsing', () => {
  it('trims the requested title', () => {
    expect(requestedTitle({ title: ' Ranger ' })).toBe('Ranger');
    expect(requestedTitle({ title: 42 })).toBe('');
    expect(requestedTitle(undefined)).toBe('');
  });
});
