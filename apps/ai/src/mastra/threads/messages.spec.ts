import type { AssistantMessage, ToolMessage } from '@ag-ui/core';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { describe, expect, it } from 'vitest';

import { CONTINUATION_SUFFIX, toAGUIMessages } from './messages';

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
  it('keeps the stored id of a user turn', () => {
    expect(
      toAGUIMessages([row('m-1', 'user', [{ type: 'text', text: 'Hello' }])]),
    ).toEqual([{ id: 'm-1', role: 'user', content: 'Hello' }]);
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
