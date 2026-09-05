import type { Message } from '@ag-ui/client';

import { normalizeThread, textOf, toolActivities } from './chat-agent';

function call(id: string, name: string) {
  return { id, type: 'function' as const, function: { name, arguments: '{}' } };
}

function shape(messages: Message[]) {
  return messages.map((m) => [
    m.id,
    m.role === 'assistant' ? m.toolCalls?.map((c) => c.id) : undefined,
  ]);
}

describe('normalizeThread', () => {
  // What the AG-UI client holds after the Mastra adapter streamed: both
  // calls on the first assistant message, their results grouped behind it,
  // the text the model wrote between the calls in a continuation message.
  const thread: Message[] = [
    { id: 'u', role: 'user', content: 'review this' },
    {
      id: 'a',
      role: 'assistant',
      toolCalls: [call('c1', 'check'), call('c2', 'present')],
    },
    { id: 't1', role: 'tool', toolCallId: 'c1', content: '{}' },
    { id: 't2', role: 'tool', toolCallId: 'c2', content: '{}' },
    { id: 'a-agui-text', role: 'assistant', content: 'Here is a proposal:' },
  ];

  it('returns the thread unchanged without placements', () => {
    expect(normalizeThread(thread, new Map())).toBe(thread);
  });

  it('returns the thread unchanged when every call is already in place', () => {
    expect(normalizeThread(thread, new Map([['c1', 'a']]))).toBe(thread);
  });

  it('moves a call made after streamed text, and its result, behind that text', () => {
    const normalized = normalizeThread(
      thread,
      new Map([['c2', 'a-agui-text']]),
    );

    expect(shape(normalized)).toEqual([
      ['u', undefined],
      ['a', ['c1']],
      ['t1', undefined],
      ['a-agui-text', ['c2']],
      ['t2', undefined],
    ]);
    // The input is left untouched, so normalising again gives the same result.
    expect(shape(thread)[1]).toEqual(['a', ['c1', 'c2']]);
    expect(shape(thread)[4]).toEqual(['a-agui-text', undefined]);
    expect(
      shape(normalizeThread(thread, new Map([['c2', 'a-agui-text']]))),
    ).toEqual(shape(normalized));
  });

  it('drops an assistant message left without text or calls', () => {
    const normalized = normalizeThread(
      [
        { id: 'a', role: 'assistant', toolCalls: [call('c1', 'present')] },
        { id: 't1', role: 'tool', toolCallId: 'c1', content: '{}' },
        { id: 'a-agui-text', role: 'assistant', content: 'Look:' },
      ],
      new Map([['c1', 'a-agui-text']]),
    );

    expect(shape(normalized)).toEqual([
      ['a-agui-text', ['c1']],
      ['t1', undefined],
    ]);
  });

  it('keeps a call whose result has not arrived yet', () => {
    const normalized = normalizeThread(
      [
        { id: 'a', role: 'assistant', toolCalls: [call('c1', 'present')] },
        { id: 'a-agui-text', role: 'assistant', content: 'streaming' },
      ],
      new Map([['c1', 'a-agui-text']]),
    );

    expect(shape(normalized)).toEqual([['a-agui-text', ['c1']]]);
  });

  it('ignores placements pointing at unknown messages', () => {
    expect(normalizeThread(thread, new Map([['c2', 'gone']]))).toBe(thread);
  });
});

describe('textOf', () => {
  it('joins the text parts of multimodal content', () => {
    expect(
      textOf({
        id: 'u',
        role: 'user',
        content: [
          { type: 'text', text: 'a' },
          { type: 'binary', mimeType: 'image/png', data: '' },
          { type: 'text', text: 'b' },
        ],
      }),
    ).toBe('a\nb');
  });
});

describe('toolActivities', () => {
  const thread: Message[] = [
    { id: 'u1', role: 'user', content: 'first' },
    { id: 'a1', role: 'assistant', toolCalls: [call('old', 'check')] },
    { id: 'u2', role: 'user', content: 'second' },
    { id: 'a2', role: 'assistant', toolCalls: [call('new', 'check')] },
  ];

  it('distinguishes current activity from an older interrupted tool', () => {
    expect(toolActivities(thread, true).get('a1')?.[0].status).toBe(
      'Incomplete',
    );
    expect(toolActivities(thread, true).get('a2')?.[0].status).toBe('Running');
    expect(toolActivities(thread, false).get('a2')?.[0].status).toBe(
      'Incomplete',
    );
  });

  it('reports a failed tool result without claiming success', () => {
    const messages: Message[] = [
      ...thread,
      {
        id: 'result',
        role: 'tool',
        toolCallId: 'new',
        content: 'Unavailable',
        error: 'Failed',
      },
    ];
    const activity = toolActivities(messages, false).get('a2')?.[0];
    expect(activity?.status).toBe('Failed');
    expect(activity?.result).toBe('Unavailable');
  });

  it('keeps partially streamed arguments readable', () => {
    const messages: Message[] = [
      {
        id: 'a',
        role: 'assistant',
        toolCalls: [
          {
            ...call('c', 'check'),
            function: { name: 'check', arguments: '{"requirement":' },
          },
        ],
      },
    ];
    expect(toolActivities(messages, true).get('a')?.[0].input).toBe(
      '{"requirement":',
    );
  });
});
