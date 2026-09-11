import { EventType, type RunAgentInput } from '@ag-ui/core';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import {
  MASTRA_RESOURCE_ID_KEY,
  RequestContext,
} from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { MockLanguageModelV3 } from 'ai/test';
import { lastValueFrom, toArray } from 'rxjs';
import { expect, it, vi } from 'vitest';

import { catalogRequest } from '../catalog/api-client';
import { canonicalHistoryProcessor } from '../threads/canonical-history';
import { HistorySafeMastraAgent } from '../threads/history-safe-agent';
import { toAGUIMessages } from '../threads/messages';
import {
  type CompetitiveAction,
  competitivePlanSchema,
} from '../workspace/competitive-contracts';
import {
  competitiveActionProcessor,
  competitiveHistory,
} from '../workspace/competitive-history';
import { renderCompetitiveWorkspace } from './competitive-workspace-tool';

vi.mock('../catalog/api-client', async (original) => ({
  ...(await original<typeof import('../catalog/api-client')>()),
  catalogRequest: vi.fn(),
}));

it('persists real tool revisions and validated user action metadata through the authenticated history bridge', async () => {
  const plan = competitivePlanSchema.parse({
    title: 'Competitive scope',
    context: { objective: 'Clarify the engineering benchmark' },
    panels: [
      {
        id: 'compare',
        type: 'comparison',
        title: 'Compare selected configurations',
      },
    ],
  });
  vi.mocked(catalogRequest).mockResolvedValue({ items: [] });
  let steps = 0;
  const model = new MockLanguageModelV3({
    doStream: async () => {
      steps++;
      const chunks =
        steps % 2
          ? [
              {
                type: 'tool-call',
                toolCallId: `competitive-call-${steps}`,
                toolName: 'renderCompetitiveWorkspace',
                input: JSON.stringify(plan),
              },
              ...(steps === 3
                ? [
                    {
                      type: 'tool-call',
                      toolCallId: 'duplicate-action-call',
                      toolName: 'renderCompetitiveWorkspace',
                      input: JSON.stringify(plan),
                    },
                  ]
                : []),
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 1 },
              },
            ]
          : [
              { type: 'text-start', id: 'text' },
              {
                type: 'text-delta',
                id: 'text',
                delta: 'The analyst workspace is ready.',
              },
              { type: 'text-end', id: 'text' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 1 },
              },
            ];
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk as never);
            controller.close();
          },
        }),
      } as never;
    },
  });
  const storage = new LibSQLStore({
    id: 'competitive-roundtrip',
    url: ':memory:',
  });
  const memory = new Memory({
    storage,
    options: { lastMessages: 40, generateTitle: false },
  });
  const agent = new Agent({
    id: 'chat',
    name: 'test analyst',
    instructions: 'Execute the competitive workspace tool once, then answer.',
    model,
    memory,
    inputProcessors: [canonicalHistoryProcessor, competitiveActionProcessor],
    tools: { renderCompetitiveWorkspace },
  });
  new Mastra({ agents: { chat: agent }, storage });
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user:test');
  const bridge = new HistorySafeMastraAgent({
    agent,
    agentId: 'chat',
    resourceId: 'user:test',
    requestContext,
  });
  const first: RunAgentInput = {
    threadId: 'thread',
    runId: 'run-one',
    state: {},
    tools: [],
    context: [],
    forwardedProps: {},
    messages: [
      { id: 'u1', role: 'user', content: 'Open competitive analysis' },
    ],
  };
  const initialEvents = await lastValueFrom(
    bridge.clone().run(first).pipe(toArray()),
  );
  expect(
    initialEvents.some((event) => event.type === EventType.RUN_ERROR),
  ).toBe(false);
  const initial = await memory.recall({
    threadId: 'thread',
    resourceId: 'user:test',
    perPage: false,
  });
  const resultEvent = initialEvents.find(
    (event) => event.type === EventType.TOOL_CALL_RESULT,
  ) as { content?: string } | undefined;
  const surfaceId = JSON.parse(resultEvent?.content ?? '{}')
    .surfaceId as string;
  expect(competitiveHistory(initial.messages, surfaceId)).toHaveLength(1);
  const action: CompetitiveAction = {
    version: 1,
    actionId: 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a2',
    surfaceId,
    expectedRevision: 1,
    componentId: 'brief',
    action: 'applyBrief',
    values: {
      ...plan.context,
      objective: 'Assess competitive dimensions',
      focusAreas: ['dimensions'],
    },
  };
  const second: RunAgentInput = {
    ...first,
    runId: 'run-two',
    forwardedProps: { workspaceAction: action },
    messages: [
      ...toAGUIMessages(initial.messages),
      { id: 'u2', role: 'user', content: 'Update the analyst brief' },
    ],
  };
  const updatedEvents = await lastValueFrom(
    bridge.clone().run(second).pipe(toArray()),
  );
  expect(
    updatedEvents
      .filter((event) => event.type === EventType.TOOL_CALL_RESULT)
      .some(
        (event) =>
          'content' in event &&
          String(event.content).includes('ACTION_ALREADY_APPLIED'),
      ),
  ).toBe(true);
  expect(
    updatedEvents.some((event) => event.type === EventType.RUN_ERROR),
  ).toBe(false);
  const updated = await memory.recall({
    threadId: 'thread',
    resourceId: 'user:test',
    perPage: false,
  });
  const revisions = competitiveHistory(updated.messages, surfaceId);
  expect(revisions).toHaveLength(2);
  expect(revisions[1]).toMatchObject({
    revision: 2,
    baseRevision: 1,
    actionId: action.actionId,
    snapshot: { plan: { context: action.values } },
  });
  expect(
    revisions[1]?.operations.some((operation) => 'createSurface' in operation),
  ).toBe(false);
  expect(
    updated.messages.find((message) => message.id === 'u2')?.content.metadata?.[
      'specsyncWorkspaceAction'
    ],
  ).toEqual(action);
  const replayedUser = toAGUIMessages(updated.messages).find(
    (message) => message.id === 'u2',
  );
  expect(replayedUser?.metadata?.['specsyncWorkspaceAction']).toEqual(action);
  const count = steps;
  await expect(
    lastValueFrom(bridge.clone().run(second).pipe(toArray())),
  ).rejects.toThrow('ACTION_ALREADY_APPLIED');
  expect(steps).toBe(count);
  const stale = {
    ...second,
    runId: 'run-three',
    forwardedProps: {
      workspaceAction: {
        ...action,
        actionId: 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a3',
      },
    },
  };
  await expect(
    lastValueFrom(bridge.clone().run(stale).pipe(toArray())),
  ).rejects.toThrow('STALE_REVISION');
  expect(steps).toBe(count);
  const foreign = new HistorySafeMastraAgent({
    agent,
    agentId: 'chat',
    resourceId: 'user:other',
    requestContext,
  });
  await expect(
    lastValueFrom(foreign.run(second).pipe(toArray())),
  ).rejects.toThrow('does not belong');
  expect(steps).toBe(count);
  await storage.close();
});
