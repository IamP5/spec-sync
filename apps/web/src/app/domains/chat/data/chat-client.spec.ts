import { TestBed } from '@angular/core/testing';
import { firstValueFrom, toArray } from 'rxjs';

import { sseEvent, stubAiStream, textDeltas } from '../../../testing/ai-stream';
import { ChatClient } from './chat-client';
import { ChatRequestError } from './chat-request-error';

describe('ChatClient', () => {
  let client: ChatClient;

  beforeEach(() => {
    client = TestBed.inject(ChatClient);
  });

  afterEach(() => vi.restoreAllMocks());

  it('posts the conversation to the chat agent and emits text deltas', async () => {
    const fetchSpy = stubAiStream(textDeltas('Hel', 'lo'), {
      chunks: [
        'data: {"type":"start","payload":{}}\n\ndata: {"type":"text-de',
        'lta","payload":{"text":"Hel"}}\n\n',
        textDeltas('lo'),
      ],
    });

    const deltas = await firstValueFrom(
      client.streamReply([{ role: 'user', content: 'hi' }]).pipe(toArray()),
    );

    expect(deltas).toEqual(['Hel', 'lo']);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/ai/api/agents/chat/stream');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  it('ignores the [DONE] terminator the server sends last', async () => {
    stubAiStream(textDeltas('ok') + 'data: [DONE]\n\n');

    const deltas = await firstValueFrom(
      client.streamReply([{ role: 'user', content: 'hi' }]).pipe(toArray()),
    );

    expect(deltas).toEqual(['ok']);
  });

  it('fails with the status when the service is unreachable', async () => {
    stubAiStream('', { status: 502 });

    await expect(
      firstValueFrom(client.streamReply([{ role: 'user', content: 'hi' }])),
    ).rejects.toEqual(new ChatRequestError(502));
  });

  it('surfaces an error chunk as a failure', async () => {
    stubAiStream(
      textDeltas('partial') +
        sseEvent({ type: 'error', payload: { error: { message: 'quota' } } }),
    );

    await expect(
      firstValueFrom(
        client.streamReply([{ role: 'user', content: 'hi' }]).pipe(toArray()),
      ),
    ).rejects.toThrow('quota');
  });
});
