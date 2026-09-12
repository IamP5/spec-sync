import type { Message } from '@ag-ui/core';
import type { ContextWithMastra } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Memory } from '@mastra/memory';

import { CHAT_AGENT_ID } from '../agents/spec-sync-agent';
import { requireVerifiedUser, verifiedUserOf } from '../identity';
import { toAGUIMessages } from './messages';
import { researchUpdates } from './research-updates';

export const CHAT_THREADS_PATH = '/chat/threads';

const MAX_TITLE_LENGTH = 200;

export interface ChatThreadSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatThread extends ChatThreadSummary {
  messages: Message[];
}

async function chatMemory(c: ContextWithMastra): Promise<Memory> {
  const memory = await c.get('mastra').getAgentById(CHAT_AGENT_ID).getMemory();
  if (!memory) {
    throw new Error('The chat agent has no memory configured');
  }
  return memory as Memory;
}

async function resourceIdOfRequest(c: ContextWithMastra): Promise<string> {
  const user = await verifiedUserOf(c.req.raw.headers);
  if (!user) {
    throw new Error('Unauthenticated request reached a chat thread route');
  }
  return user.resourceId;
}

function summaryOf(thread: {
  id: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}): ChatThreadSummary {
  return {
    id: thread.id,
    title: thread.title ?? '',
    createdAt: thread.createdAt.getTime(),
    updatedAt: thread.updatedAt.getTime(),
  };
}

async function ownedThread(
  memory: Memory,
  threadId: string,
  resourceId: string,
) {
  const thread = await memory.getThreadById({ threadId });
  return thread && thread.resourceId === resourceId ? thread : null;
}

export const chatThreadRoutes = [
  registerApiRoute(`${CHAT_THREADS_PATH}/:threadId/research-updates`, {
    method: 'POST',
    middleware: requireVerifiedUser,
    handler: async (c) => {
      c.header('Cache-Control', 'no-store');
      const user = await verifiedUserOf(c.req.raw.headers);
      if (!user) return c.json({ error: 'Authentication required' }, 401);
      const memory = await chatMemory(c);
      const threadId = c.req.param('threadId');
      const thread = await ownedThread(memory, threadId, user.resourceId);
      if (!thread) return c.json({ error: 'Not found' }, 404);
      const updates = await researchUpdates(
        memory,
        threadId,
        user.resourceId,
        user.uid,
        c.req.raw.signal,
      );
      return c.json({ ...summaryOf(thread), ...updates });
    },
  }),

  registerApiRoute(CHAT_THREADS_PATH, {
    method: 'GET',
    middleware: requireVerifiedUser,
    handler: async (c) => {
      const memory = await chatMemory(c);
      const { threads } = await memory.listThreads({
        filter: { resourceId: await resourceIdOfRequest(c) },
        perPage: false,
        orderBy: { field: 'updatedAt', direction: 'DESC' },
      });
      return c.json({ threads: threads.map(summaryOf) });
    },
  }),

  registerApiRoute(`${CHAT_THREADS_PATH}/:threadId`, {
    method: 'GET',
    middleware: requireVerifiedUser,
    handler: async (c) => {
      const memory = await chatMemory(c);
      const resourceId = await resourceIdOfRequest(c);
      const threadId = c.req.param('threadId');
      const thread = await ownedThread(memory, threadId, resourceId);
      if (!thread) {
        return c.json({ error: 'Not found' }, 404);
      }
      const { messages } = await memory.recall({
        threadId,
        resourceId,
        perPage: false,
      });
      const body: ChatThread = {
        ...summaryOf(thread),
        messages: toAGUIMessages(messages),
      };
      return c.json(body);
    },
  }),

  registerApiRoute(`${CHAT_THREADS_PATH}/:threadId`, {
    method: 'PATCH',
    middleware: requireVerifiedUser,
    handler: async (c) => {
      const memory = await chatMemory(c);
      const resourceId = await resourceIdOfRequest(c);
      const threadId = c.req.param('threadId');
      if (!(await ownedThread(memory, threadId, resourceId))) {
        return c.json({ error: 'Not found' }, 404);
      }
      const title = requestedTitle(await c.req.json());
      if (!title) {
        return c.json({ error: 'A title is required' }, 400);
      }
      return c.json(
        summaryOf(await memory.updateThread({ id: threadId, title })),
      );
    },
  }),

  registerApiRoute(`${CHAT_THREADS_PATH}/:threadId`, {
    method: 'DELETE',
    middleware: requireVerifiedUser,
    handler: async (c) => {
      const memory = await chatMemory(c);
      const resourceId = await resourceIdOfRequest(c);
      const threadId = c.req.param('threadId');
      if (!(await ownedThread(memory, threadId, resourceId))) {
        return c.json({ error: 'Not found' }, 404);
      }
      await memory.deleteThread(threadId);
      return c.body(null, 204);
    },
  }),

  registerApiRoute(CHAT_THREADS_PATH, {
    method: 'DELETE',
    middleware: requireVerifiedUser,
    handler: async (c) => {
      const memory = await chatMemory(c);
      const { threads } = await memory.listThreads({
        filter: { resourceId: await resourceIdOfRequest(c) },
        perPage: false,
      });
      for (const thread of threads) {
        await memory.deleteThread(thread.id);
      }
      return c.body(null, 204);
    },
  }),
];

export function requestedTitle(body: unknown): string {
  const title = isRecord(body) ? body['title'] : undefined;
  return typeof title === 'string'
    ? title.trim().slice(0, MAX_TITLE_LENGTH)
    : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
