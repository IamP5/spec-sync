import type { Message } from '@ag-ui/client';

import { hasContent, transcriptOf } from './chat-message';

function call(id: string, name: string, args: unknown = {}) {
  return {
    id,
    type: 'function' as const,
    function: { name, arguments: JSON.stringify(args) },
  };
}

describe('transcriptOf', () => {
  it('keeps user, thinking and assistant text in order', () => {
    const messages = [
      { id: 'u1', role: 'user', content: 'Ranger Raptor torque?' },
      { id: 'r1', role: 'reasoning', content: 'Look it up.' },
      { id: 'a1', role: 'assistant', content: '583 Nm.' },
    ] as Message[];
    expect(transcriptOf(messages, false)).toEqual([
      { kind: 'user', id: 'u1', text: 'Ranger Raptor torque?' },
      { kind: 'reasoning', id: 'r1', text: 'Look it up.' },
      expect.objectContaining({ kind: 'assistant', id: 'a1', text: '583 Nm.' }),
    ]);
  });

  it('pairs each visible call with its real result', () => {
    const messages = [
      { id: 'u1', role: 'user', content: 'Compare' },
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        toolCalls: [call('c1', 'compareVehicleConfigurations', { ids: [] })],
      },
      {
        id: 'c1-result',
        role: 'tool',
        toolCallId: 'c1',
        content: '{"rows":[]}',
      },
    ] as unknown as Message[];
    const [, assistant] = transcriptOf(messages, false);
    expect(assistant).toMatchObject({
      kind: 'assistant',
      toolCalls: [
        {
          id: 'c1',
          name: 'compareVehicleConfigurations',
          args: { ids: [] },
          status: 'complete',
          result: '{"rows":[]}',
        },
      ],
    });
  });

  it('marks a call without a result as running only during the run', () => {
    const messages = [
      { id: 'u1', role: 'user', content: 'Search' },
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        toolCalls: [call('c1', 'searchVehicleConfigurations')],
      },
    ] as unknown as Message[];
    const running = transcriptOf(messages, true)[1];
    const ended = transcriptOf(messages, false)[1];
    expect(running).toMatchObject({ toolCalls: [{ status: 'executing' }] });
    expect(ended).toMatchObject({ toolCalls: [{ status: 'complete' }] });
  });

  it('hides internal tools unless activity is shown', () => {
    const messages = [
      { id: 'u1', role: 'user', content: 'Specs' },
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        toolCalls: [call('c1', 'listComparisonAttributes')],
      },
      {
        id: 'c1-result',
        role: 'tool',
        toolCallId: 'c1',
        content: '{"items":[]}',
      },
    ] as unknown as Message[];
    const assistant = transcriptOf(messages, false)[1];
    if (assistant?.kind !== 'assistant') throw new Error('expected a turn');
    expect(assistant.toolCalls).toEqual([]);
    expect(hasContent(assistant, false)).toBe(false);
    expect(hasContent(assistant, true)).toBe(true);
  });
});
