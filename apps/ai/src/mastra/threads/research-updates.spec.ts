import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import type { Memory } from '@mastra/memory';
import { beforeEach, expect, it, vi } from 'vitest';

const read = vi.hoisted(() => vi.fn());
vi.mock('../research/client', () => ({ readResearch: read }));
import {
  researchSnapshotSchema,
  summarizeResearch,
} from '../research/contracts';
import { compileCompetitiveWorkspace } from '../workspace/competitive-compiler';
import { competitivePlanSchema } from '../workspace/competitive-contracts';
import { toAGUIMessages } from './messages';
import { RESEARCH_COMPLETION_PART } from './research-completion';
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
it('delivers one explicit persisted completion across polls, concurrent tabs and saved replay', async () => {
  const [first, second] = await Promise.all([
    researchUpdates(memory, 'thread', 'user:alice', 'alice'),
    researchUpdates(memory, 'thread', 'user:alice', 'alice'),
  ]);
  expect(first.map((message) => message.id)).toEqual(
    second.map((message) => message.id),
  );
  expect(stored).toHaveLength(2);
  expect(stored.every((message) => message.role === 'assistant')).toBe(true);
  expect(first).toEqual([
    {
      id: expect.stringMatching(/^research-ready-/),
      role: 'activity',
      activityType: 'specsync.research-completion',
      content: {
        version: 1,
        requestId: id,
        workId: snapshot.workId,
        status: 'REVIEW',
        vehicle: {
          brand: 'Ford',
          model: 'Ranger',
          market: 'BR',
          modelYear: 2025,
        },
        counts: { configurations: 0, claims: 0, warnings: 0 },
        updatedAt: snapshot.updatedAt,
      },
    },
  ]);
  expect(stored[1]?.content.parts).toEqual([
    { type: 'text', text: expect.stringContaining('Ford Ranger 2025') },
    { type: RESEARCH_COMPLETION_PART, data: first[0]?.content },
  ]);
  expect(JSON.stringify(first)).not.toContain('reviewVehicleResearch');
  expect(toAGUIMessages(stored).slice(-1)).toEqual(first);
  expect(stored[1]).toMatchObject({
    threadId: 'thread',
    resourceId: 'user:alice',
  });
  const calls = save.mock.calls.length;
  expect(
    await researchUpdates(memory, 'thread', 'user:alice', 'alice'),
  ).toEqual(first);
  expect(save).toHaveBeenCalledTimes(calls);
  expect(read).toHaveBeenCalledWith('alice', id, undefined);
});

it('records publication explicitly instead of claiming unreviewed evidence is published', async () => {
  read.mockResolvedValue({ ...snapshot, status: 'PUBLISHED' });
  const updates = await researchUpdates(
    memory,
    'thread',
    'user:alice',
    'alice',
  );
  expect(updates[0]).toMatchObject({
    role: 'activity',
    content: { status: 'PUBLISHED' },
  });
  expect(stored[1]?.content.parts[0]).toMatchObject({
    type: 'text',
    text: expect.stringContaining(
      'A publicação no catálogo já está disponível.',
    ),
  });
});

it('records extracted counts and all warnings from authoritative research', async () => {
  read.mockResolvedValue({
    ...snapshot,
    warnings: ['Check source date'],
    configurations: [
      {
        name: 'XLT',
        claims: [{ issues: [] }, { issues: ['unit'] }],
        warnings: ['Check trim'],
        unmappedObservations: [],
      },
      {
        name: 'Limited',
        claims: [{ issues: [] }],
        warnings: [],
        unmappedObservations: [],
      },
    ],
  });
  const updates = await researchUpdates(
    memory,
    'thread',
    'user:alice',
    'alice',
  );
  expect(updates[0]).toMatchObject({
    role: 'activity',
    content: { counts: { configurations: 2, claims: 3, warnings: 2 } },
  });
});

it('delivers an explicitly declared workspace research panel without an earlier research tool', async () => {
  const plan = competitivePlanSchema.parse({
    title: 'Competitive research',
    context: { objective: 'Review Ford Ranger evidence' },
    panels: [
      {
        id: 'research',
        type: 'research',
        title: 'Ranger research',
        requestId: id,
      },
    ],
  });
  const args = plan.panels[0];
  if (!args) throw new Error('Missing panel fixture');
  const result = compileCompetitiveWorkspace(
    plan,
    [
      {
        id: 'research',
        type: 'research',
        title: 'Ranger research',
        args,
        result: summarizeResearch(
          researchSnapshotSchema.parse({ ...snapshot, status: 'PROCESSING' }),
        ),
      },
    ],
    [],
    {
      surfaceId: 'competitive-b98e8caa-d7e5-4440-8a9c-f5c267ab3fb1',
      baseRevision: 0,
    },
  );
  const original = stored[0];
  if (!original) throw new Error('Missing original fixture');
  original.content.parts = [
    {
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: 'workspace',
        toolName: 'renderCompetitiveWorkspace',
        args: plan,
        result: JSON.stringify(result),
      },
    },
  ];
  const updates = await researchUpdates(
    memory,
    'thread',
    'user:alice',
    'alice',
  );
  expect(updates).toHaveLength(1);
  expect(updates[0]).toMatchObject({
    role: 'activity',
    content: { requestId: id, status: 'REVIEW' },
  });
  expect(read).toHaveBeenCalledWith('alice', id, undefined);
  expect(JSON.stringify(stored[0])).not.toContain(
    'researchVehicleSpecifications',
  );
});

it('ignores arbitrary nested research IDs in an invalid workspace result', async () => {
  const original = stored[0];
  if (!original) throw new Error('Missing original fixture');
  original.content.parts = [
    {
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: 'workspace',
        toolName: 'renderCompetitiveWorkspace',
        args: {},
        result: {
          id,
          snapshot: { plan: { panels: [{ type: 'research', requestId: id }] } },
        },
      },
    },
  ];
  expect(
    await researchUpdates(memory, 'thread', 'user:alice', 'alice'),
  ).toEqual([]);
  expect(read).not.toHaveBeenCalled();
});

it('preserves legacy notifications and does not deliver another event for their subscription', async () => {
  const legacy: MastraDBMessage = {
    id: 'research-ready-historical',
    role: 'assistant',
    threadId: 'thread',
    resourceId: 'user:alice',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'historical-review',
            toolName: 'reviewVehicleResearch',
            args: { id },
            result: { id, reviewReady: true },
          },
        },
      ],
    },
  };
  stored.push(legacy);
  expect(
    await researchUpdates(memory, 'thread', 'user:alice', 'alice'),
  ).toEqual(toAGUIMessages([legacy]));
  expect(save).not.toHaveBeenCalled();
  expect(read).not.toHaveBeenCalled();
  expect(stored[1]).toBe(legacy);
});

it('deduplicates different subscriptions to the same shared work in one thread', async () => {
  const secondId = 'a098e418-f5eb-473f-a74e-04645a3b9bf8';
  const original = stored[0];
  if (!original) throw new Error('Missing original fixture');
  stored.push({
    ...original,
    id: 'another-request',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'second-start',
            toolName: 'getVehicleResearch',
            args: { id: secondId },
            result: { id: secondId },
          },
        },
      ],
    },
  });
  read.mockImplementation(async (_uid, requestId) => ({
    ...snapshot,
    id: requestId,
  }));
  expect(
    await researchUpdates(memory, 'thread', 'user:alice', 'alice'),
  ).toHaveLength(1);
  expect(save).toHaveBeenCalledOnce();
});

it('does not save a completion if cancellation happens while the research read resolves', async () => {
  const controller = new AbortController();
  const aborted = new Error('Thread request cancelled');
  read.mockImplementation(async () => {
    controller.abort(aborted);
    return snapshot;
  });
  await expect(
    researchUpdates(memory, 'thread', 'user:alice', 'alice', controller.signal),
  ).rejects.toBe(aborted);
  expect(save).not.toHaveBeenCalled();
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
  ).toHaveLength(1);
  expect(save).toHaveBeenCalledOnce();
});
