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
import { PRESENT_REQUIREMENT_DRAFT_TOOL } from '../../data/requirement-draft';
import { ConversationDetailStore } from './conversation-detail-store';

describe('ConversationDetailStore', () => {
  let agent: FakeChatAgent;

  beforeEach(() => {
    agent = new FakeChatAgent();
    TestBed.configureTestingModule({ providers: provideFakeChatAgent(agent) });
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
        'checkRequirementQuality',
        { requirement: 'x' },
        { score: 1 },
        'Done',
      ),
    );
    const store = TestBed.inject(ConversationDetailStore);

    await store.send('review x');

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
        'checkRequirementQuality',
        {},
        {},
        'Proposal:',
      ).flatMap((event) =>
        event.type === EventType.RUN_FINISHED
          ? [
              {
                type: EventType.TOOL_CALL_START,
                toolCallId: 'call-present',
                toolCallName: PRESENT_REQUIREMENT_DRAFT_TOOL,
                parentMessageId: `reply-${input.runId}`,
              } as BaseEvent,
              {
                type: EventType.TOOL_CALL_ARGS,
                toolCallId: 'call-present',
                delta: '{"title":"T","statement":"S"}',
              } as BaseEvent,
              {
                type: EventType.TOOL_CALL_END,
                toolCallId: 'call-present',
              } as BaseEvent,
              {
                type: EventType.TOOL_CALL_RESULT,
                toolCallId: 'call-present',
                messageId: 'call-present-result',
                content: '{"presented":true}',
                role: 'tool',
              } as BaseEvent,
              event,
            ]
          : [event],
      ),
    );
    const store = TestBed.inject(ConversationDetailStore);

    await store.send('review x');

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
      ['assistant', ['checkRequirementQuality']],
      ['assistant', [PRESENT_REQUIREMENT_DRAFT_TOOL]],
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

  it('does not advertise the frontend tools before the chat page registers them', async () => {
    agent.replyWith((input) => textReply(input, 'x'));
    const store = TestBed.inject(ConversationDetailStore);

    await store.send('hi');

    expect(agent.runs[0].tools.map((tool) => tool.name)).not.toContain(
      PRESENT_REQUIREMENT_DRAFT_TOOL,
    );
  });
});
