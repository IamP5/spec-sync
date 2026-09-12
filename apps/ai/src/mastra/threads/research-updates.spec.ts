import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { Memory } from '@mastra/memory';
import { beforeEach, expect, it, vi } from 'vitest';

const read = vi.hoisted(() => vi.fn());
vi.mock('../research/client', () => ({ readResearch: read }));
import { researchUpdates } from './research-updates';

const id = 'b0bf3b8d-12fb-45ae-83d4-5b41b61c559a';
const snapshot = {
  id,
  workId: 'b98e8caa-d7e5-4440-8a9c-f5c267ab3fb1',
  requestStatus: 'ACTIVE',
  disposition: 'JOINED',
  request: {
    sourceUrl: 'https://ford.com.br/ranger.pdf',
    brand: 'Ford',
    model: 'Ranger',
    market: 'BR',
    modelYear: 2025,
    configurations: [],
  },
  status: 'REVIEW',
  attempts: 1,
  stage: 'review',
  configurations: [],
  warnings: [],
  error: null,
  source: null,
  configurationIds: {},
  createdAt: '2026-09-08T12:00:00Z',
  updatedAt: '2026-09-08T12:01:00Z',
};
let stored: MastraDBMessage[];
const save = vi.fn(async ({ messages }: { messages: MastraDBMessage[] }) => {
  for (const message of messages) {
    stored = [...stored.filter((item) => item.id !== message.id), message];
  }
  return { messages };
});
const memory = {
  recall: async () => ({ messages: stored }),
  saveMessages: save,
} as unknown as Memory;
beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue(snapshot);
  stored = [
    {
      id: 'original',
      threadId: 'thread',
      resourceId: 'user:alice',
      createdAt: new Date(),
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'start',
              toolName: 'researchVehicleSpecifications',
              args: {},
              result: { id },
            },
          },
        ],
      },
    },
  ];
});
it('delivers review as a persisted assistant action, once across polls and concurrent tabs', async () => {
  const [first, second] = await Promise.all([
    researchUpdates(memory, 'thread', 'user:alice', 'alice'),
    researchUpdates(memory, 'thread', 'user:alice', 'alice'),
  ]);
  expect(first.map((message) => message.id)).toEqual(
    second.map((message) => message.id),
  );
  expect(stored).toHaveLength(2);
  expect(stored.every((message) => message.role === 'assistant')).toBe(true);
  expect(first[0]).toMatchObject({
    role: 'assistant',
    toolCalls: [{ function: { name: 'reviewVehicleResearch' } }],
  });
  expect(JSON.stringify(first)).toContain('reviewReady');
  const calls = save.mock.calls.length;
  expect(
    await researchUpdates(memory, 'thread', 'user:alice', 'alice'),
  ).toEqual(first);
  expect(save).toHaveBeenCalledTimes(calls);
  expect(read).toHaveBeenCalledWith('alice', id, undefined);
});
it('keeps the review call id within the limit OpenAI enforces on replay', async () => {
  const [message] = await researchUpdates(
    memory,
    'thread',
    'user:alice',
    'alice',
  );
  const call = (message as { toolCalls?: { id: string }[] }).toolCalls?.[0];
  expect(call?.id).toMatch(/^rr-[0-9a-f]{32}$/);
  expect(call?.id.length).toBeLessThanOrEqual(40);
});
it.each(['QUEUED', 'PROCESSING', 'FAILED', 'REJECTED'])(
  'waits for reviewable evidence instead of announcing %s as ready',
  async (status) => {
    read.mockResolvedValue({ ...snapshot, status });
    expect(
      await researchUpdates(memory, 'thread', 'user:alice', 'alice'),
    ).toEqual([]);
    expect(save).not.toHaveBeenCalled();
  },
);
it('does not disclose a cancelled or inaccessible subscription', async () => {
  read.mockResolvedValue({ ...snapshot, requestStatus: 'CANCELLED' });
  expect(
    await researchUpdates(memory, 'thread', 'user:alice', 'alice'),
  ).toEqual([]);
  read.mockRejectedValue(new Error('Not found'));
  expect(
    await researchUpdates(memory, 'thread', 'user:alice', 'alice'),
  ).toEqual([]);
  expect(save).not.toHaveBeenCalled();
});
it('retries transient failures without losing the eventual review action', async () => {
  read.mockRejectedValueOnce(new Error('Unavailable'));
  expect(
    await researchUpdates(memory, 'thread', 'user:alice', 'alice'),
  ).toEqual([]);
  expect(
    await researchUpdates(memory, 'thread', 'user:alice', 'alice'),
  ).toHaveLength(2);
  expect(save).toHaveBeenCalledOnce();
});
