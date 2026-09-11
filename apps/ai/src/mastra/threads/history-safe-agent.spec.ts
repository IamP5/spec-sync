import type { RunAgentInput } from '@ag-ui/core';
import { Agent } from '@mastra/core/agent';
import {
  type MastraDBMessage,
  MessageList,
} from '@mastra/core/agent/message-list';
import { lastValueFrom, toArray } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { HistorySafeMastraAgent } from './history-safe-agent';
import { toAGUIMessages } from './messages';

function stored() {
  const list = new MessageList({ threadId: 'thread', resourceId: 'user:test' });
  for (const n of [1, 2]) {
    list.add({ id: `u${n}`, role: 'user', content: `Research ${n}` }, 'input');
    list.add(
      {
        id: `a${n}`,
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: `c${n}`,
            toolName: 'getVehicleResearch',
            args: { id: `research-${n}` },
          },
        ],
      },
      'response',
    );
    list.add(
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: `c${n}`,
            toolName: 'getVehicleResearch',
            result: { id: `research-${n}` },
          },
        ],
      },
      'response',
    );
  }
  return list.get.all.db();
}

function setup(rows: MastraDBMessage[]) {
  const local = Object.create(Agent.prototype) as Agent;
  const stream = vi.fn(async (_messages: unknown, _options: unknown) => ({
    fullStream: (async function* () {
      yield { type: 'finish', payload: {} };
    })(),
  }));
  Object.assign(local, {
    getMemory: async () => ({
      recall: async () => ({ messages: rows }),
      getWorkingMemory: async () => null,
      getThreadById: async () => ({ resourceId: 'user:test' }),
    }),
    listTools: async () => ({}),
    stream,
  });
  return {
    bridge: new HistorySafeMastraAgent({
      agent: local,
      agentId: 'chat',
      resourceId: 'user:test',
    }),
    stream,
  };
}
function input(rows: MastraDBMessage[]): RunAgentInput {
  return {
    threadId: 'thread',
    runId: 'run',
    state: {},
    tools: [],
    context: [],
    forwardedProps: {},
    messages: [
      ...toAGUIMessages(rows),
      { id: 'u3', role: 'user', content: 'Next question' },
    ],
  };
}

describe('history-safe Mastra bridge', () => {
  it('does not re-ingest completed tool results or merge earlier turns on the third run', async () => {
    const rows = stored();
    const { bridge, stream } = setup(rows);
    await lastValueFrom(bridge.run(input(rows)).pipe(toArray()));
    expect(stream).toHaveBeenCalledOnce();
    expect(stream.mock.calls[0]?.[0]).toEqual([
      { id: 'u3', role: 'user', content: 'Next question' },
    ]);
  });

  it('does not run the model when the request only echoes stored history', async () => {
    const rows = stored();
    const { bridge, stream } = setup(rows);
    const request = input(rows);
    request.messages.pop();
    await lastValueFrom(bridge.run(request).pipe(toArray()));
    expect(stream).not.toHaveBeenCalled();
  });

  it('allows regeneration of the final user message without replaying prior tool results', async () => {
    const rows = stored();
    const { bridge, stream } = setup(rows);
    const request = input(rows);
    request.messages = toAGUIMessages(rows).slice(0, 4);
    expect(request.messages.at(-1)?.role).toBe('user');
    await lastValueFrom(bridge.run(request).pipe(toArray()));
    expect(stream.mock.calls[0]?.[0]).toEqual([
      { id: 'u2', role: 'user', content: 'Research 2' },
    ]);
  });
});

describe('pending results and runtime lifecycle', () => {
  it('retains an unresolved frontend result with its own call and without previous server calls', async () => {
    const rows = stored();
    const request = input(rows);
    request.messages.pop();
    const part = rows[3]?.content.parts.find(
      (part) => part.type === 'tool-invocation',
    );
    if (!part || part.type !== 'tool-invocation')
      throw new Error('Missing fixture call');
    part.toolInvocation = {
      state: 'call',
      toolCallId: 'c2',
      toolName: 'getVehicleResearch',
      args: { id: 'research-2' },
    };
    const { bridge, stream } = setup(rows);
    await lastValueFrom(bridge.run(request).pipe(toArray()));
    const sent = stream.mock.calls[0]?.[0];
    expect(JSON.stringify(sent)).not.toContain('c1');
    expect(JSON.stringify(sent)).toContain('c2');
    const list = new MessageList({
      threadId: 'thread',
      resourceId: 'user:test',
    });
    list.add(sent as Parameters<MessageList['add']>[0], 'input');
    const messages = list.get.all.db();
    expect(messages.map((message) => message.id)).toEqual(['a2']);
    expect(messages[0]?.content.parts[0]).toMatchObject({
      toolInvocation: { state: 'result', toolCallId: 'c2' },
    });
  });

  it('keeps the safe adapter and verified resource when CopilotKit clones the agent', async () => {
    const rows = stored();
    const { bridge, stream } = setup(rows);
    const clone = bridge.clone();
    expect(clone).toBeInstanceOf(HistorySafeMastraAgent);
    expect(clone.resourceId).toBe('user:test');
    await lastValueFrom(clone.run(input(rows)).pipe(toArray()));
    expect(stream.mock.calls[0]?.[0]).toEqual([
      { id: 'u3', role: 'user', content: 'Next question' },
    ]);
  });

  it('rejects another resource before running the model', async () => {
    const { bridge, stream } = setup(stored());
    bridge.resourceId = 'user:other';
    await expect(
      lastValueFrom(bridge.run(input(stored())).pipe(toArray())),
    ).rejects.toThrow('does not belong');
    expect(stream).not.toHaveBeenCalled();
  });

  it('fails closed if recall fails instead of replaying the whole history', async () => {
    const { bridge, stream } = setup(stored());
    Object.assign(bridge.agent, {
      getMemory: async () => {
        throw new Error('Storage unavailable');
      },
    });
    await expect(
      lastValueFrom(bridge.run(input(stored())).pipe(toArray())),
    ).rejects.toThrow('Storage unavailable');
    expect(stream).not.toHaveBeenCalled();
  });
});

describe('interrupt resume without fresh messages', () => {
  it('passes an accepted interrupt to the real bridge resume path', async () => {
    const rows = stored();
    const { bridge, stream } = setup(rows);
    const resumeStream = vi.fn(async () => ({
      fullStream: (async function* () {
        yield { type: 'finish', payload: {} };
      })(),
    }));
    Object.assign(bridge.agent, { resumeStream });
    const request = input(rows);
    request.messages.pop();
    request.resume = [
      {
        interruptId: 'original-run::pending-call',
        status: 'resolved',
        payload: { approved: true },
      },
    ];
    await lastValueFrom(bridge.run(request).pipe(toArray()));
    expect(resumeStream).toHaveBeenCalledOnce();
    expect(stream).not.toHaveBeenCalled();
  });
  it('completes a declined interrupt without executing the tool or model', async () => {
    const rows = stored();
    const { bridge, stream } = setup(rows);
    const resumeStream = vi.fn();
    Object.assign(bridge.agent, { resumeStream });
    const request = input(rows);
    request.messages.pop();
    request.resume = [
      { interruptId: 'original-run::pending-call', status: 'cancelled' },
    ];
    const events = await lastValueFrom(bridge.run(request).pipe(toArray()));
    expect(events.at(-1)?.type).toBe('RUN_FINISHED');
    expect(resumeStream).not.toHaveBeenCalled();
    expect(stream).not.toHaveBeenCalled();
  });
});
