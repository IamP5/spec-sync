import { TestBed } from '@angular/core/testing';

import {
  sseEvent,
  stubAiStream,
  textDeltas,
} from '../../../../testing/ai-stream';
import { ConversationDetailStore } from './conversation-detail-store';

describe('ConversationDetailStore', () => {
  afterEach(() => vi.restoreAllMocks());

  it('starts empty and idle', () => {
    const store = TestBed.inject(ConversationDetailStore);
    expect(store.isEmpty()).toBe(true);
    expect(store.status()).toBe('idle');
  });

  it('appends the user turn and streams the reply into an assistant message', async () => {
    const fetchSpy = stubAiStream(textDeltas('Hello', ' there'));
    const store = TestBed.inject(ConversationDetailStore);

    store.send('hi');
    expect(store.status()).toBe('streaming');
    expect(store.messages()).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: '' },
    ]);

    await settled(store);

    expect(store.status()).toBe('idle');
    expect(store.messages()).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Hello there' },
    ]);
    // Only the history is sent; the pending assistant placeholder is not.
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).messages).toEqual([
      { role: 'user', content: 'hi' },
    ]);
  });

  it('records the error and drops the empty reply when the stream fails', async () => {
    stubAiStream(sseEvent({ type: 'error', payload: { error: 'boom' } }));
    const store = TestBed.inject(ConversationDetailStore);

    store.send('hi');
    await settled(store);

    expect(store.status()).toBe('error');
    expect(store.error()).toBeInstanceOf(Error);
    expect(store.messages()).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('ignores a send while a reply is streaming', () => {
    stubAiStream(textDeltas('x'));
    const store = TestBed.inject(ConversationDetailStore);

    store.send('first');
    store.send('second');

    expect(store.messages().filter((m) => m.role === 'user')).toHaveLength(1);
    store.reset();
  });

  it('reset clears the conversation', async () => {
    stubAiStream(textDeltas('x'));
    const store = TestBed.inject(ConversationDetailStore);

    store.send('hi');
    await settled(store);
    store.reset();

    expect(store.isEmpty()).toBe(true);
    expect(store.status()).toBe('idle');
  });
});

async function settled(store: { status: () => string }): Promise<void> {
  for (let i = 0; i < 50 && store.status() === 'streaming'; i++) {
    await new Promise((resolve) => setTimeout(resolve));
  }
}
