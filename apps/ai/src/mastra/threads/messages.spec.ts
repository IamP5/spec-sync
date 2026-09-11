import type { AssistantMessage, ToolMessage } from '@ag-ui/core';
import {
  type MastraDBMessage,
  MessageList,
} from '@mastra/core/agent/message-list';
import { describe, expect, it } from 'vitest';

import { CONTINUATION_SUFFIX, toAGUIMessages } from './messages';
import { RESEARCH_COMPLETION_PART } from './research-completion';

const completion = {
  version: 1,
  requestId: 'b0bf3b8d-12fb-45ae-83d4-5b41b61c559a',
  workId: 'b98e8caa-d7e5-4440-8a9c-f5c267ab3fb1',
  status: 'REVIEW',
  vehicle: { brand: 'Ford', model: 'Ranger', market: 'BR', modelYear: 2025 },
  counts: { configurations: 2, claims: 40, warnings: 3 },
  updatedAt: '2026-09-10T12:00:00Z',
};

function row(
  id: string,
  role: 'user' | 'assistant',
  parts: unknown[],
): MastraDBMessage {
  return {
    id,
    role,
    createdAt: new Date('2026-09-07T10:00:00.000Z'),
    threadId: 't-1',
    resourceId: 'user:u-1',
    content: { format: 2, parts: parts as never },
  };
}

const toolPart = (
  toolCallId: string,
  toolName: string,
  args: unknown,
  result: unknown,
  extra: Record<string, unknown> = {},
) => ({
  type: 'tool-invocation',
  toolInvocation: {
    state: 'result',
    step: 0,
    toolCallId,
    toolName,
    args,
    result,
    ...extra,
  },
});

describe('toAGUIMessages', () => {
  it('replays a native Mastra data part as one activity while retaining text for the model', () => {
    const stored = row('research-ready-1', 'assistant', [
      { type: 'text', text: 'Ford Ranger research is ready for review.' },
      { type: RESEARCH_COMPLETION_PART, data: completion },
    ]);
    const list = new MessageList({ threadId: 't-1', resourceId: 'user:u-1' });
    list.add(stored, 'memory');
    expect(toAGUIMessages(list.get.all.db())).toEqual([
      {
        id: stored.id,
        role: 'activity',
        activityType: 'specsync.research-completion',
        content: completion,
      },
    ]);
    expect(list.get.all.aiV5.model()).toEqual([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Ford Ranger research is ready for review.' },
        ],
      },
    ]);
    expect(list.get.all.db()[0]?.content.parts).toContainEqual({
      type: RESEARCH_COMPLETION_PART,
      data: completion,
    });
  });

  it('falls back to canonical text for an unsupported completion payload', () => {
    expect(
      toAGUIMessages([
        row('invalid', 'assistant', [
          { type: 'text', text: 'Research finished.' },
          {
            type: RESEARCH_COMPLETION_PART,
            data: { ...completion, version: 2 },
          },
        ]),
      ]),
    ).toEqual([
      { id: 'invalid', role: 'assistant', content: 'Research finished.' },
    ]);
  });

  it('does not reclassify real tool calls or user input as completion events', () => {
    const part = { type: RESEARCH_COMPLETION_PART, data: completion };
    const messages = toAGUIMessages([
      row('user', 'user', [{ type: 'text', text: 'Continue' }, part]),
      row('mixed', 'assistant', [
        part,
        toolPart(
          'real',
          'getVehicleResearch',
          {},
          { id: completion.requestId },
        ),
      ]),
    ]);
    expect(messages.map((message) => message.role)).toEqual([
      'user',
      'assistant',
      'tool',
    ]);
    expect(messages[1]).toMatchObject({ toolCalls: [{ id: 'real' }] });
  });

  it('keeps the stored id of a user turn', () => {
    expect(
      toAGUIMessages([row('m-1', 'user', [{ type: 'text', text: 'Hello' }])]),
    ).toEqual([{ id: 'm-1', role: 'user', content: 'Hello' }]);
  });

  it('replays only the validated workspace action metadata of a user turn', () => {
    const action = {
      version: 1,
      actionId: 'b0bf3b8d-12fb-45ae-83d4-5b41b61c559a',
      surfaceId: 'competitive-b98e8caa-d7e5-4440-8a9c-f5c267ab3fb1',
      expectedRevision: 2,
      componentId: 'evidence',
      action: 'retryPanel',
      values: {},
    };
    const stored = row('user-action', 'user', [
      { type: 'text', text: 'Retry evidence' },
    ]);
    stored.content.metadata = {
      specsyncWorkspaceAction: action,
      unrelated: 'private metadata',
    };
    expect(toAGUIMessages([stored])).toEqual([
      {
        id: 'user-action',
        role: 'user',
        content: 'Retry evidence',
        metadata: { specsyncWorkspaceAction: action },
      },
    ]);
    stored.content.metadata['specsyncWorkspaceAction'] = {
      ...action,
      values: { arbitrary: 'command' },
    };
    expect(toAGUIMessages([stored])).toEqual([
      {
        id: 'user-action',
        role: 'user',
        content: 'Retry evidence',
      },
    ]);
  });

  it('drops rows without renderable parts', () => {
    expect(
      toAGUIMessages([row('m-2', 'assistant', [{ type: 'step-start' }])]),
    ).toEqual([]);
  });

  it('renders a plain answer under the stored id', () => {
    expect(
      toAGUIMessages([
        row('m-3', 'assistant', [
          { type: 'step-start' },
          { type: 'text', text: 'Two doors.' },
        ]),
      ]),
    ).toEqual([{ id: 'm-3', role: 'assistant', content: 'Two doors.' }]);
  });

  it('splits the text written after a tool call into the continuation message', () => {
    const messages = toAGUIMessages([
      row('m-4', 'assistant', [
        { type: 'step-start' },
        { type: 'text', text: 'Let me look it up.' },
        toolPart('call-1', 'searchVehicles', { query: 'ranger' }, { hits: 2 }),
        { type: 'text', text: 'I found two.' },
      ]),
    ]);

    expect(messages.map((message) => [message.id, message.role])).toEqual([
      ['m-4', 'assistant'],
      ['call-1-result', 'tool'],
      [`m-4${CONTINUATION_SUFFIX}`, 'assistant'],
    ]);
    const [first, result, continuation] = messages as [
      AssistantMessage,
      ToolMessage,
      AssistantMessage,
    ];
    expect(first.content).toBe('Let me look it up.');
    expect(first.toolCalls).toEqual([
      {
        id: 'call-1',
        type: 'function',
        function: {
          name: 'searchVehicles',
          arguments: '{"query":"ranger"}',
        },
      },
    ]);
    expect(result).toEqual({
      id: 'call-1-result',
      role: 'tool',
      toolCallId: 'call-1',
      content: '{"hits":2}',
    });
    expect(continuation.content).toBe('I found two.');
    expect(continuation.toolCalls).toBeUndefined();
  });

  it('keeps a second tool call with the text that introduced it', () => {
    const messages = toAGUIMessages([
      row('m-5', 'assistant', [
        { type: 'text', text: 'First.' },
        toolPart('call-1', 'a', {}, 'one'),
        { type: 'text', text: 'Second.' },
        toolPart('call-2', 'b', {}, 'two'),
      ]),
    ]);

    expect(messages.map((message) => [message.id, message.role])).toEqual([
      ['m-5', 'assistant'],
      ['call-1-result', 'tool'],
      [`m-5${CONTINUATION_SUFFIX}`, 'assistant'],
      ['call-2-result', 'tool'],
    ]);
    expect((messages[2] as AssistantMessage).toolCalls?.[0]?.id).toBe('call-2');
  });

  it('reports a failed tool result as an error', () => {
    const [, result] = toAGUIMessages([
      row('m-6', 'assistant', [
        toolPart('call-1', 'a', {}, 'boom', {
          isError: true,
          errorText: 'Upstream refused',
        }),
      ]),
    ]) as [AssistantMessage, ToolMessage];
    expect(result.error).toBe('Upstream refused');
  });

  it('leaves out a tool call that never produced a result', () => {
    const messages = toAGUIMessages([
      row('m-7', 'assistant', [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            step: 0,
            toolCallId: 'call-1',
            toolName: 'a',
            args: {},
          },
        },
      ]),
    ]);
    expect(messages).toHaveLength(1);
    expect((messages[0] as AssistantMessage).toolCalls).toHaveLength(1);
  });

  it('renders thinking summaries as reasoning turns', () => {
    const messages = toAGUIMessages([
      row('m-8', 'assistant', [
        { type: 'reasoning', reasoning: 'Comparing trims.', details: [] },
        { type: 'text', text: 'The Titanium is wider.' },
      ]),
    ]);
    expect(messages.map((message) => message.role)).toEqual([
      'reasoning',
      'assistant',
    ]);
    expect(messages[0]).toEqual({
      id: 'm-8-reasoning-0',
      role: 'reasoning',
      content: 'Comparing trims.',
    });
  });

  it('reads a thinking summary from its detail parts', () => {
    const [reasoning] = toAGUIMessages([
      row('m-9', 'assistant', [
        {
          type: 'reasoning',
          details: [
            { type: 'text', text: 'One. ' },
            { type: 'text', text: 'Two.' },
          ],
        },
        { type: 'text', text: 'Done.' },
      ]),
    ]);
    expect(reasoning).toEqual({
      id: 'm-9-reasoning-0',
      role: 'reasoning',
      content: 'One. Two.',
    });
  });
});

describe('replayed tool history', () => {
  it('keeps the native result in its original later turn and removes the equivalent serialized copy', () => {
    const original = toolPart(
      'call-2',
      'getVehicleResearch',
      { id: 'research-2' },
      { id: 'research-2', status: 'REVIEW' },
    );
    const copy = toolPart(
      'call-2',
      'getVehicleResearch',
      { id: 'research-2' },
      JSON.stringify({ status: 'REVIEW', id: 'research-2' }),
    );
    const rows = [
      row('a1', 'assistant', [copy]),
      row('u2', 'user', [{ type: 'text', text: 'Open research' }]),
      row('a2', 'assistant', [original]),
    ];
    const messages = toAGUIMessages(rows);
    expect(messages.map((m) => m.id)).toEqual(['u2', 'a2', 'call-2-result']);
    expect(rows[0]?.content.parts).toHaveLength(1);
  });

  it('preserves different calls that intentionally reopen the same research', () => {
    const messages = toAGUIMessages([
      row('a1', 'assistant', [
        toolPart('c1', 'getVehicleResearch', {}, { id: 'same' }),
      ]),
      row('a2', 'assistant', [
        toolPart('c2', 'getVehicleResearch', {}, { id: 'same' }),
      ]),
    ]);
    expect(messages.filter((m) => m.role === 'assistant')).toHaveLength(2);
  });

  it('does not silently pick a result for conflicting call identities', () => {
    expect(() =>
      toAGUIMessages([
        row('a1', 'assistant', [
          toolPart('same-call', 'getVehicleResearch', {}, { id: 'one' }),
        ]),
        row('a2', 'assistant', [
          toolPart('same-call', 'getVehicleResearch', {}, { id: 'two' }),
        ]),
      ]),
    ).toThrow('Conflicting stored tool call');
  });
});
