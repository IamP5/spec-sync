import { BaseEvent, EventType } from '@ag-ui/client';
import { TestBed } from '@angular/core/testing';
import { CopilotKit } from '@copilotkit/angular';
import { CopilotKitCoreErrorCode } from '@copilotkit/core';
import { Dispatcher } from '@ngrx/signals/events';
import { of, Subject } from 'rxjs';

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
import { BEFORE_CHAT_REQUEST } from '../../data/chat-agent';
import type { ResearchUpdates } from '../../data/thread';
import { threadEvents } from '../../data/thread-events';
import { ConversationDetailStore } from './conversation-detail-store';

describe('ConversationDetailStore', () => {
  let agent: FakeChatAgent;
  let threads: FakeThreadClient;
  let authenticate: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    localStorage.clear();
    agent = new FakeChatAgent();
    authenticate = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        ...provideFakeChatAgent(agent),
        ...provideFakeThreads(),
        { provide: BEFORE_CHAT_REQUEST, useValue: authenticate },
      ],
    });
    threads = TestBed.inject(FakeThreadClient);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** A run that starts a research, so the store asks the service about it. */
  function startResearch(): void {
    agent.replyWith((input) =>
      toolCallReply(
        input,
        'researchVehicleSpecifications',
        {},
        { id: 'private-request' },
        'Pesquisando',
      ),
    );
  }

  /** Flushes the effects and waits until the service was asked `times` times. */
  async function askedTimes(
    client: { mock: { calls: unknown[] } },
    times: number,
  ): Promise<void> {
    await vi.waitFor(() => {
      TestBed.tick();
      expect(client.mock.calls).toHaveLength(times);
    });
  }

  it('appends persisted completion without another model run or duplicate messages', async () => {
    const update = {
      id: 'research-ready-test',
      role: 'assistant' as const,
      content: 'Pesquisa concluída. Revise os dados.',
    };
    const client = vi
      .spyOn(threads, 'researchUpdates')
      .mockImplementation(() => of({ messages: [update], pending: false }));
    agent.replyWith((input) =>
      toolCallReply(
        input,
        'researchVehicleSpecifications',
        {},
        { id: 'private-request' },
        'Pesquisando',
      ),
    );
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('Pesquisar Ranger');
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(client).toHaveBeenCalled();
    expect(
      store.messages().filter((message) => message.id === update.id),
    ).toHaveLength(1);
    expect(agent.runs).toHaveLength(1);
    const id = store.threadId();
    store.reset();
    await store.open(id);
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      store.messages().filter((message) => message.id === update.id),
    ).toHaveLength(1);
    expect(agent.runs).toHaveLength(1);
  });

  it('ignores a completion response after switching conversations', async () => {
    const pending = new Subject<ResearchUpdates>();
    vi.spyOn(threads, 'researchUpdates').mockReturnValue(pending);
    startResearch();
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('Pesquisar Ranger');
    TestBed.tick();
    store.reset();
    pending.next({
      messages: [
        { id: 'research-ready-old', role: 'assistant', content: 'Ready' },
      ],
      pending: false,
    });
    pending.complete();
    await Promise.resolve();
    expect(store.messages()).toEqual([]);
  });

  it('stops asking for research updates once the service has nothing left to announce', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = vi
      .spyOn(threads, 'researchUpdates')
      .mockReturnValue(of({ messages: [], pending: false }));
    startResearch();
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('Pesquisar Ranger');
    await askedTimes(client, 1);

    await vi.advanceTimersByTimeAsync(30_000);
    TestBed.tick();

    expect(client).toHaveBeenCalledTimes(1);
  });

  it('keeps asking every eight seconds while a research is still running', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = vi
      .spyOn(threads, 'researchUpdates')
      .mockReturnValue(of({ messages: [], pending: true }));
    startResearch();
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('Pesquisar Ranger');
    await askedTimes(client, 1);

    await vi.advanceTimersByTimeAsync(8_000);
    await askedTimes(client, 2);
    await vi.advanceTimersByTimeAsync(8_000);
    await askedTimes(client, 3);
  });

  it('asks again after the thread is reopened and after the next run', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = vi
      .spyOn(threads, 'researchUpdates')
      .mockReturnValue(of({ messages: [], pending: false }));
    startResearch();
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('Pesquisar Ranger');
    await askedTimes(client, 1);
    const id = store.threadId();

    store.reset();
    await vi.advanceTimersByTimeAsync(10_000);
    TestBed.tick();
    expect(client).toHaveBeenCalledTimes(1);

    await store.open(id);
    await askedTimes(client, 2);
    expect(client).toHaveBeenLastCalledWith(id);

    agent.replyWith((input) => textReply(input, 'Mais uma resposta'));
    await store.send('E agora?');
    await askedTimes(client, 3);
  });

  it('never asks about a thread that started no research', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = vi.spyOn(threads, 'researchUpdates');
    agent.replyWith((input) => textReply(input, 'Hello'));
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('hi');
    TestBed.tick();

    await vi.advanceTimersByTimeAsync(30_000);
    TestBed.tick();

    expect(client).not.toHaveBeenCalled();
  });

  it.each(['stop', 'reset', 'open'] as const)(
    'does not start a run after %s while authentication is pending',
    async (action) => {
      const authentication = deferred<void>();
      authenticate.mockImplementation(() => authentication.promise);
      threads.seed(
        storedThread('saved', 'Saved', 1, [
          { id: 'saved-message', role: 'user', content: 'A saved question' },
        ]),
      );
      const store = TestBed.inject(ConversationDetailStore);
      const sending = store.send('Old question');
      if (action === 'open') await store.open('saved');
      else store[action]();
      const messages = agent.messages;

      authentication.resolve();
      await sending;

      expect(agent.runs).toHaveLength(0);
      expect(store.messages()).toEqual(messages);
      expect(store.status()).toBe('idle');
      if (action === 'open') expect(store.threadId()).toBe('saved');
    },
  );

  it.each(['resolve', 'reject'] as const)(
    'keeps a newer run streaming when stopped authentication later %ss',
    async (completion) => {
      const previous = deferred<void>();
      const current = deferred<void>();
      authenticate
        .mockImplementationOnce(() => previous.promise)
        .mockImplementationOnce(() => current.promise);
      agent.replyWith((input) => textReply(input, 'Current reply'));
      const store = TestBed.inject(ConversationDetailStore);
      const first = store.send('First');
      store.stop();
      const second = store.send('Second');

      if (completion === 'reject')
        previous.reject(new Error('Old auth failure'));
      else previous.resolve();
      await first;

      expect(store.status()).toBe('streaming');
      expect(store.error()).toBeUndefined();
      current.resolve();
      await second;
      expect(agent.runs).toHaveLength(1);
      expect(store.status()).toBe('idle');
      expect(store.turns()[store.turns().length - 1]?.content).toBe(
        'Current reply',
      );
    },
  );

  it('shows an authentication failure and retries the existing user turn', async () => {
    authenticate.mockRejectedValueOnce(new Error('Token refresh failed'));
    const store = TestBed.inject(ConversationDetailStore);

    await expect(store.send('My question')).resolves.toBeUndefined();

    expect(store.status()).toBe('error');
    expect(store.error()?.error.message).toBe('Token refresh failed');
    expect(agent.runs).toHaveLength(0);
    agent.replyWith((input) => textReply(input, 'Recovered'));
    await store.regenerate();
    expect(store.status()).toBe('idle');
    expect(store.turns().map((turn) => turn.content)).toEqual([
      'My question',
      'Recovered',
    ]);
  });

  it('records a rejected runtime promise as a retryable error', async () => {
    vi.spyOn(TestBed.inject(CopilotKit).core, 'runAgent').mockRejectedValue(
      new Error('Transport disconnected'),
    );
    const store = TestBed.inject(ConversationDetailStore);

    await expect(store.send('My question')).resolves.toBeUndefined();

    expect(store.status()).toBe('error');
    expect(store.error()).toMatchObject({
      code: CopilotKitCoreErrorCode.AGENT_RUN_FAILED,
      error: new Error('Transport disconnected'),
    });
  });

  it('waits for a stopped transport to finish before starting the next run', async () => {
    const previous = deferred<{ newMessages: never[]; result: undefined }>();
    const current = deferred<{ newMessages: never[]; result: undefined }>();
    const runAgent = vi
      .spyOn(TestBed.inject(CopilotKit).core, 'runAgent')
      .mockImplementationOnce(() => previous.promise)
      .mockImplementationOnce(() => current.promise);
    const store = TestBed.inject(ConversationDetailStore);
    const first = store.send('First');
    await vi.waitFor(() => expect(runAgent).toHaveBeenCalledTimes(1));
    store.stop();
    const second = store.send('Second');
    await Promise.resolve();
    expect(runAgent).toHaveBeenCalledTimes(1);

    previous.resolve({ newMessages: [], result: undefined });
    await first;
    await vi.waitFor(() => expect(runAgent).toHaveBeenCalledTimes(2));
    expect(store.status()).toBe('streaming');

    current.resolve({ newMessages: [], result: undefined });
    await second;
    expect(store.status()).toBe('idle');
  });

  it.each(['success', 'failure'] as const)(
    'ignores stale navigation %s while the newer conversation is loading',
    async (result) => {
      const previous = new Subject<ReturnType<typeof storedThread>>();
      const current = new Subject<ReturnType<typeof storedThread>>();
      vi.spyOn(threads, 'find').mockImplementation((id) =>
        id === 'first' ? previous : current,
      );
      const store = TestBed.inject(ConversationDetailStore);
      const first = store.open('first');
      const second = store.open('second');

      if (result === 'failure') previous.error(new Error('Old read failed'));
      else previous.next(storedThread('first', 'First', 1, []));
      await expect(first).resolves.toBe(true);
      expect(store.loading()).toBe(true);
      expect(store.threadId()).not.toBe('first');

      current.next(storedThread('second', 'Second', 2, []));
      await expect(second).resolves.toBe(true);
      expect(store.loading()).toBe(false);
      expect(store.threadId()).toBe('second');
    },
  );

  it('keeps the newer conversation after an older read returns last', async () => {
    const previous = new Subject<ReturnType<typeof storedThread>>();
    vi.spyOn(threads, 'find').mockImplementation((id) =>
      id === 'first' ? previous : of(storedThread('second', 'Second', 2, [])),
    );
    const store = TestBed.inject(ConversationDetailStore);
    const first = store.open('first');
    await store.open('second');

    previous.next(storedThread('first', 'First', 1, []));
    await first;

    expect(store.threadId()).toBe('second');
    expect(store.title()).toBe('Second');
  });

  it('does not reopen a conversation after a reset during its read', async () => {
    const pending = new Subject<ReturnType<typeof storedThread>>();
    vi.spyOn(threads, 'find').mockReturnValue(pending);
    const store = TestBed.inject(ConversationDetailStore);
    const opening = store.open('saved');
    store.reset();
    const emptyThread = store.threadId();

    pending.next(storedThread('saved', 'Saved', 1, []));
    await opening;

    expect(store.threadId()).toBe(emptyThread);
    expect(store.isEmpty()).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('cancels a pending navigation when returning to the current conversation', async () => {
    const pending = new Subject<ReturnType<typeof storedThread>>();
    vi.spyOn(threads, 'find').mockReturnValue(pending);
    const store = TestBed.inject(ConversationDetailStore);
    const current = store.threadId();
    const opening = store.open('other');

    await expect(store.open(current)).resolves.toBe(true);
    expect(store.loading()).toBe(false);
    pending.next(storedThread('other', 'Other', 1, []));
    await opening;

    expect(store.threadId()).toBe(current);
    expect(store.isEmpty()).toBe(true);
  });

  it('keeps the first send running when its route selects the current thread', async () => {
    const authentication = deferred<void>();
    authenticate.mockImplementation(() => authentication.promise);
    agent.replyWith((input) => textReply(input, 'Reply'));
    const store = TestBed.inject(ConversationDetailStore);
    const sending = store.send('First question');

    await expect(store.open(store.threadId())).resolves.toBe(true);
    expect(store.status()).toBe('streaming');
    authentication.resolve();
    await sending;

    expect(agent.runs).toHaveLength(1);
    expect(store.status()).toBe('idle');
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

  it('reopens a thread of this session without asking the service again', async () => {
    agent.replyWith((input) => textReply(input, 'first reply'));
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('first');
    const first = store.threadId();
    const find = vi.spyOn(threads, 'find');

    store.reset();
    await store.send('second');
    await expect(store.open(first)).resolves.toBe(true);

    expect(find).not.toHaveBeenCalled();
    expect(store.loading()).toBe(false);
    expect(store.threadId()).toBe(first);
    expect(store.title()).toBe('first');
    expect(store.turns().map((turn) => turn.content)).toEqual([
      'first',
      'first reply',
    ]);
  });

  it('forgets a kept thread once the service deleted it', async () => {
    agent.replyWith((input) => textReply(input, 'ok'));
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('first');
    const first = store.threadId();
    store.reset();

    TestBed.inject(Dispatcher).dispatch(threadEvents.removed(first));

    const find = vi.spyOn(threads, 'find');
    await expect(store.open(first)).resolves.toBe(false);
    expect(find).toHaveBeenCalledWith(first);
  });

  it('rename shows the new title while the service stores it', async () => {
    agent.replyWith((input) => textReply(input, 'x'));
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('hi');

    store.rename('Greeting');

    expect(store.title()).toBe('Greeting');
  });

  it('forwards the picked mode and effort with a run and omits what was not picked', async () => {
    agent.replyWith((input) => textReply(input, 'Hello'));
    const store = TestBed.inject(ConversationDetailStore);
    await store.send('Hi', { mode: 'intelligent', effort: 'high' });
    expect(agent.runs[agent.runs.length - 1]?.forwardedProps).toMatchObject({
      mode: 'intelligent',
      effort: 'high',
      // The language is not a per-run choice: it travels with every run so
      // the agent answers in the language the interface is running in.
      locale: 'en-US',
    });
    await store.regenerate({ mode: 'velocity' });
    const forwarded = () =>
      agent.runs[agent.runs.length - 1]?.forwardedProps as
        | Record<string, unknown>
        | undefined;
    expect(forwarded()).toMatchObject({ mode: 'velocity' });
    expect(forwarded()?.['effort']).toBeUndefined();
    await store.regenerate({ mode: '', effort: '' });
    expect(forwarded()?.['mode']).toBeUndefined();
    expect(forwarded()?.['effort']).toBeUndefined();
    expect(forwarded()?.['locale']).toBe('en-US');
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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
