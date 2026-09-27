import type { Message } from '@ag-ui/client';

import { chatMessagesOf } from './chat-message';

describe('chatMessagesOf', () => {
  it('keeps user and assistant text in order', () => {
    const messages = [
      { id: 'u1', role: 'user', content: 'Ranger Raptor torque?' },
      { id: 'a1', role: 'assistant', content: '583 Nm.' },
    ] as Message[];
    expect(chatMessagesOf(messages)).toEqual([
      { id: 'u1', role: 'user', text: 'Ranger Raptor torque?' },
      { id: 'a1', role: 'assistant', text: '583 Nm.' },
    ]);
  });

  it('joins text parts and skips tool traffic and empty turns', () => {
    const messages = [
      {
        id: 'u1',
        role: 'user',
        content: [
          { type: 'text', text: 'Compare ' },
          { type: 'text', text: 'trims' },
        ],
      },
      { id: 'a1', role: 'assistant', content: '', toolCalls: [] },
      { id: 't1', role: 'tool', content: '{}', toolCallId: 'c1' },
    ] as unknown as Message[];
    expect(chatMessagesOf(messages)).toEqual([
      { id: 'u1', role: 'user', text: 'Compare trims' },
    ]);
  });
});
