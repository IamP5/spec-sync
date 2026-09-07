import { BaseEvent, EventType } from '@ag-ui/client';
import { TestBed } from '@angular/core/testing';

import {
  failedRun,
  FakeChatAgent,
  provideFakeChatAgent,
  settled,
  textReply,
  toolCallReply,
} from '../../../../testing/fake-chat-agent';
import {
  FakeThreadClient,
  provideFakeThreads,
  storedThread,
} from '../../../../testing/fake-threads';
import { matrix } from '../../../../testing/vehicle-fixtures';
import { ConversationDetailStore } from './conversation-detail-store';

describe('ConversationDetailStore', () => {
  let agent: FakeChatAgent;
  let threads: FakeThreadClient;

  beforeEach(() => {
    localStorage.clear();
    agent = new FakeChatAgent();
    TestBed.configureTestingModule({
      providers: [...provideFakeChatAgent(agent), ...provideFakeThreads()],
    });
    threads = TestBed.inject(FakeThreadClient);
  });

  it('restores explicit comparison selection and keeps it isolated between threads', async () => {
    agent.replyWith((input) =>
      toolCallReply(
        input,
        'compareVehicleConfigurations',
        {},
        matrix,
        'Compared',
      ),
    );
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('Compare vehicles');
    const first = store.threadId();
    agent.replyWith((input) => textReply(input, 'Follow-up'));
    await store.send('Add transmission');
    expect(
      agent.runs[agent.runs.length - 1]?.context.some(
        (c) =>
          c.description.includes('SpecSync comparison selection') &&
          c.value.includes('camera_360'),
      ),
    ).toBe(true);
    const restored = store.messages();
    threads.seed(storedThread(first, 'Compare vehicles', 1, restored));
    store.reset();
    await store.send('New chat');
    expect(
      agent.runs[agent.runs.length - 1]?.context.find((c) =>
        c.description.includes('SpecSync comparison selection'),
      )?.value,
    ).toBe('null');
    await store.open(first);
    await store.send('Show sources');
    expect(
      agent.runs[agent.runs.length - 1]?.state['comparison'],
    ).toMatchObject({
      configurationIds: matrix.configurations.map((c) => c.id),
    });
  });

  it('leaves the history to the service and writes nothing itself', async () => {
    agent.replyWith((input) => textReply(input, 'Hello'));
    const store = TestBed.inject(ConversationDetailStore);

    await store.send('# Reset password\nby email');

    expect(store.title()).toBe('Reset password');
    expect(threads.all()).toEqual([]);
  });

  it('open replaces the conversation with the thread the service returns', async () => {
    agent.replyWith((input) => textReply(input, 'first reply'));
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('first');
    const first = store.threadId();
    threads.seed(storedThread(first, 'first', 1, store.messages()));
    store.reset();
    await store.send('second');

    await expect(store.open(first)).resolves.toBe(true);

    expect(store.threadId()).toBe(first);
    expect(store.title()).toBe('first');
    expect(store.turns().map((turn) => turn.content)).toEqual([
      'first',
      'first reply',
    ]);
    await expect(store.open('missing')).resolves.toBe(false);
    expect(store.threadId()).toBe(first);
  });

  it('rename shows the new title while the service stores it', async () => {
    agent.replyWith((input) => textReply(input, 'x'));
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('hi');

    store.rename('Greeting');

    expect(store.title()).toBe('Greeting');
  });

  it('forwards the picked model and effort with a run and omits what was not picked', async () => {
    agent.replyWith((input) => textReply(input, 'Hello'));
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('Hi', { model: 'gpt-5.6-luna', effort: 'high' });
    expect(agent.runs[agent.runs.length - 1]?.forwardedProps).toMatchObject({
      model: 'gpt-5.6-luna',
      effort: 'high',
    });
    await store.regenerate({ model: 'gemini-2.5-pro' });
    const forwarded = () =>
      agent.runs[agent.runs.length - 1]?.forwardedProps as
        | Record<string, unknown>
        | undefined;
    expect(forwarded()).toMatchObject({ model: 'gemini-2.5-pro' });
    expect(forwarded()?.['effort']).toBeUndefined();
    await store.regenerate({ model: '', effort: '' });
    expect(forwarded()?.['model']).toBeUndefined();
    expect(forwarded()?.['effort']).toBeUndefined();
  });

  it('starts empty and idle', () => {
    const store = TestBed.inject(ConversationDetailStore);
    expect(store.isEmpty()).toBe(true);
    expect(store.status()).toBe('idle');
  });

  it('appends the user turn and streams the reply into an assistant turn', async () => {
    agent.replyWith((input) => textReply(input, 'Hello', ' there'));
    const store = TestBed.inject(ConversationDetailStore);

    const sending = store.send('hi');
    expect(store.status()).toBe('streaming');
    // The agent publishes the new message on the next tick, before any reply.
    await new Promise((resolve) => setTimeout(resolve));
    expect(store.turns().map((turn) => turn.role)).toEqual(['user']);

    await sending;

    expect(store.status()).toBe('idle');
    expect(store.turns().map((turn) => [turn.role, turn.content])).toEqual([
      ['user', 'hi'],
      ['assistant', 'Hello there'],
    ]);
    // The whole thread goes with every run: the service is stateless.
    expect(agent.runs).toHaveLength(1);
    expect(agent.runs[0].messages.map((m) => m.role)).toEqual(['user']);
  });

  it('keeps tool messages in the thread and out of the turns', async () => {
    agent.replyWith((input) =>
      toolCallReply(
        input,
        'searchVehicleConfigurations',
        { q: 'Ranger' },
        { items: [] },
        'Done',
      ),
    );
    const store = TestBed.inject(ConversationDetailStore);

    await store.send('find Ranger');

    expect(store.messages().map((m) => m.role)).toEqual([
      'user',
      'assistant',
      'tool',
      'assistant',
    ]);
    expect(store.turns().map((m) => m.role)).toEqual([
      'user',
      'assistant',
      'assistant',
    ]);
  });

  it('shows a call made after streamed text below that text', async () => {
    // The Mastra adapter attaches every call of a run to the first assistant
    // message; the transcript restores the order in which things happened.
    agent.replyWith((input) =>
      toolCallReply(
        input,
        'searchVehicleConfigurations',
        {},
        {},
        'Proposal:',
      ).flatMap((event) =>
        event.type === EventType.RUN_FINISHED
          ? [
              {
                type: EventType.TOOL_CALL_START,
                toolCallId: 'call-present',
                toolCallName: 'compareVehicleConfigurations',
                parentMessageId: `reply-${input.runId}`,
              } as BaseEvent,
              {
                type: EventType.TOOL_CALL_ARGS,
                toolCallId: 'call-present',
                delta: JSON.stringify({
                  configurationIds: matrix.configurations.map(
                    (item) => item.id,
                  ),
                }),
              } as BaseEvent,
              {
                type: EventType.TOOL_CALL_END,
                toolCallId: 'call-present',
              } as BaseEvent,
              {
                type: EventType.TOOL_CALL_RESULT,
                toolCallId: 'call-present',
                messageId: 'call-present-result',
                content: JSON.stringify(matrix),
                role: 'tool',
              } as BaseEvent,
              event,
            ]
          : [event],
      ),
    );
    const store = TestBed.inject(ConversationDetailStore);

    await store.send('find Ranger');

    const shape = () =>
      store
        .turns()
        .map((turn) => [
          turn.role,
          turn.role === 'assistant'
            ? turn.toolCalls?.map((c) => c.function.name)
            : undefined,
        ]);
    expect(shape()).toEqual([
      ['user', undefined],
      ['assistant', ['searchVehicleConfigurations']],
      ['assistant', ['compareVehicleConfigurations']],
    ]);
    // The agent's own thread was rewritten the same way for the next run:
    // each tool result follows the message that owns its call.
    expect(
      agent.messages.map((m) =>
        m.role === 'tool' ? `tool:${m.toolCallId}` : m.role,
      ),
    ).toEqual([
      'user',
      'assistant',
      `tool:call-${agent.runs[0].runId}`,
      'assistant',
      'tool:call-present',
    ]);
  });

  it('records the error when the run fails', async () => {
    agent.replyWith((input) => failedRun(input, 'boom'));
    const store = TestBed.inject(ConversationDetailStore);

    await store.send('hi');
    await settled(store);

    expect(store.status()).toBe('error');
    expect(store.error()?.error).toBeInstanceOf(Error);
    expect(store.turns().map((turn) => turn.role)).toEqual(['user']);
  });

  it('ignores a send while a reply is streaming', async () => {
    agent.replyWith((input) => textReply(input, 'x'));
    const store = TestBed.inject(ConversationDetailStore);

    const first = store.send('first');
    await store.send('second');
    await first;

    expect(store.turns().filter((m) => m.role === 'user')).toHaveLength(1);
  });

  it('stop marks the reply as cut short until the next run', async () => {
    agent.replyWith((input) => textReply(input, 'x'));
    const store = TestBed.inject(ConversationDetailStore);

    const sending = store.send('hi');
    store.stop();
    expect(store.status()).toBe('idle');
    expect(store.stopped()).toBe(true);
    await sending;

    await store.send('again');
    expect(store.stopped()).toBe(false);
  });

  it('regenerate replaces the last reply', async () => {
    agent.replyWith((input) => textReply(input, 'first'));
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('hi');

    agent.replyWith((input) => textReply(input, 'second'));
    await store.regenerate();

    expect(store.turns().map((turn) => [turn.role, turn.content])).toEqual([
      ['user', 'hi'],
      ['assistant', 'second'],
    ]);
    expect(agent.runs).toHaveLength(2);
    // The second run sent the thread without the first reply.
    expect(agent.runs[1].messages.map((m) => m.role)).toEqual(['user']);
  });

  it('regenerate retries the last turn after a failed run', async () => {
    agent.replyWith((input) => failedRun(input, 'boom'));
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('hi');
    await settled(store);
    expect(store.status()).toBe('error');

    agent.replyWith((input) => textReply(input, 'recovered'));
    await store.regenerate();

    expect(store.status()).toBe('idle');
    expect(store.error()).toBeUndefined();
    expect(store.turns().map((turn) => turn.role)).toEqual([
      'user',
      'assistant',
    ]);
  });

  it('regenerate does nothing on an empty conversation', async () => {
    const store = TestBed.inject(ConversationDetailStore);
    await store.regenerate();
    expect(agent.runs).toHaveLength(0);
  });

  it('reset clears the conversation and starts a new thread', async () => {
    agent.replyWith((input) => textReply(input, 'x'));
    const store = TestBed.inject(ConversationDetailStore);

    await store.send('hi');
    const firstThread = agent.runs[0].threadId;
    store.reset();

    expect(store.isEmpty()).toBe(true);
    expect(store.status()).toBe('idle');
    expect(agent.threadId).not.toBe(firstThread);
  });

  it('does not advertise server tools as frontend tools', async () => {
    agent.replyWith((input) => textReply(input, 'x'));
    const store = TestBed.inject(ConversationDetailStore);

    await store.send('hi');

    expect(agent.runs[0].tools).toEqual([]);
  });
});
