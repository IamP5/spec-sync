import { EventType, type RunAgentInput } from '@ag-ui/core';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { MockLanguageModelV3 } from 'ai/test';
import { lastValueFrom, toArray } from 'rxjs';
import { expect, it } from 'vitest';
import { z } from 'zod';

import { canonicalHistoryProcessor } from './canonical-history';
import { HistorySafeMastraAgent } from './history-safe-agent';
import { toAGUIMessages } from './messages';

it('persists three real agent/tool/AG-UI rounds without copying tool calls across user turns', async () => {
  let step = 0;
  let executions = 0;
  const prompts: string[] = [];
  const model = new MockLanguageModelV3({
    doStream: async (options) => {
      prompts.push(JSON.stringify(options.prompt));
      step++;
      const chunks =
        step % 2
          ? [
              {
                type: 'tool-call',
                toolCallId: `c${Math.ceil(step / 2)}`,
                toolName: 'lookup',
                input: '{}',
              },
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
                delta: 'Found the saved research.',
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
  const storage = new LibSQLStore({ id: 'history-roundtrip', url: ':memory:' });
  const memory = new Memory({
    storage,
    options: { lastMessages: 40, generateTitle: false },
  });
  const agent = new Agent({
    id: 'chat',
    name: 'test chat',
    instructions: 'Look up research once and answer.',
    model,
    memory,
    inputProcessors: [canonicalHistoryProcessor],
    tools: {
      lookup: createTool({
        id: 'lookup',
        description: 'Read saved research',
        inputSchema: z.object({}),
        outputSchema: z.object({ id: z.string() }),
        execute: async () => ({ id: `research-${++executions}` }),
      }),
    },
  });
  new Mastra({ agents: { chat: agent }, storage });
  const bridge = new HistorySafeMastraAgent({
    agent,
    agentId: 'chat',
    resourceId: 'user:test',
  });
  const owners = new Map<string, string>();
  for (const round of [1, 2, 3]) {
    const before =
      round === 1
        ? { messages: [] }
        : await memory.recall({
            threadId: 'thread',
            resourceId: 'user:test',
            perPage: false,
          });
    const input: RunAgentInput = {
      threadId: 'thread',
      runId: `run-${round}`,
      state: {},
      tools: [],
      context: [],
      forwardedProps: {},
      messages: [
        ...toAGUIMessages(before.messages),
        { id: `u${round}`, role: 'user', content: `Look up research ${round}` },
      ],
    };
    const events = await lastValueFrom(
      bridge.clone().run(input).pipe(toArray()),
    );
    expect(events.some((event) => event.type === EventType.RUN_ERROR)).toBe(
      false,
    );
    expect(
      events.filter((event) => event.type === EventType.TOOL_CALL_START),
    ).toHaveLength(1);
    const after = await memory.recall({
      threadId: 'thread',
      resourceId: 'user:test',
      perPage: false,
    });
    const calls = after.messages.flatMap((message) =>
      message.content.parts.flatMap((part) =>
        part.type === 'tool-invocation'
          ? [{ id: part.toolInvocation.toolCallId, owner: message.id }]
          : [],
      ),
    );
    expect(calls).toHaveLength(round);
    expect(new Set(calls.map((call) => call.id)).size).toBe(round);
    for (const call of calls) {
      if (owners.has(call.id)) expect(call.owner).toBe(owners.get(call.id));
      owners.set(call.id, call.owner);
    }
  }
  expect(executions).toBe(3);
  expect(step).toBe(6);
  // On the third request the model still sees both earlier user turns.
  expect(prompts[4]).toContain('Look up research 1');
  expect(prompts[4]).toContain('Look up research 2');
  // Simulate the confirmed legacy corruption, then verify the real memory
  // processor removes the serialized copy before the next provider request.
  const saved = await memory.recall({
    threadId: 'thread',
    resourceId: 'user:test',
    perPage: false,
  });
  const assistants = saved.messages.filter(
    (message) => message.role === 'assistant',
  );
  const first = assistants[0];
  const originalPart = assistants[1]?.content.parts.find(
    (part) => part.type === 'tool-invocation',
  );
  if (!first || !originalPart) throw new Error('Missing stored calls');
  const copied = structuredClone(originalPart);
  if (
    copied.type !== 'tool-invocation' ||
    copied.toolInvocation.state !== 'result'
  )
    throw new Error('Missing result');
  copied.toolInvocation.result = JSON.stringify(copied.toolInvocation.result);
  await memory.saveMessages({
    messages: [
      {
        ...first,
        content: { ...first.content, parts: [...first.content.parts, copied] },
      },
    ],
  });
  const corrupted = await memory.recall({
    threadId: 'thread',
    resourceId: 'user:test',
    perPage: false,
  });
  await lastValueFrom(
    bridge
      .run({
        threadId: 'thread',
        runId: 'run-4',
        state: {},
        tools: [],
        context: [],
        forwardedProps: {},
        messages: [
          ...toAGUIMessages(corrupted.messages),
          { id: 'u4', role: 'user', content: 'One more lookup' },
        ],
      })
      .pipe(toArray()),
  );
  const providerPrompt = JSON.parse(prompts[6] ?? 'null') as {
    content: { type: string; toolCallId?: string }[] | string;
  }[];
  const providerCalls = providerPrompt.flatMap((message) =>
    Array.isArray(message.content)
      ? message.content
          .filter((part) => part.type === 'tool-call')
          .map((part) => part.toolCallId)
      : [],
  );
  expect(providerCalls).toEqual(['c1', 'c2', 'c3']);
  await storage.close();
});
