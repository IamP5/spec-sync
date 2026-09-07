import {
  AbstractAgent,
  BaseEvent,
  EventType,
  RunAgentInput,
} from '@ag-ui/client';
import type { Provider } from '@angular/core';
import { provideCopilotKit } from '@copilotkit/angular';
import { asyncScheduler, from, Observable, observeOn } from 'rxjs';

import {
  CHAT_AGENT_ID,
  CONTINUATION_SUFFIX,
} from '../domains/chat/data/chat-agent';
import { provideFakeAuth } from './fake-auth';

type Script = (input: RunAgentInput) => BaseEvent[];

/**
 * In-browser AG-UI agent standing in for the CopilotKit runtime of `apps/ai`.
 * Each run replays the events its script returns, asynchronously, exactly as
 * the real client would receive them over the wire. Tests inspect `runs` to
 * assert what was sent.
 */
export class FakeChatAgent extends AbstractAgent {
  readonly runs: RunAgentInput[] = [];
  private script: Script = () => [];

  constructor() {
    super({ agentId: CHAT_AGENT_ID, threadId: 'thread-test' });
  }

  /** Sets what the next runs answer with. */
  replyWith(script: Script): this {
    this.script = script;
    return this;
  }

  override run(input: RunAgentInput): Observable<BaseEvent> {
    this.runs.push(input);
    return from(this.script(input)).pipe(observeOn(asyncScheduler));
  }
}

/** Registers `agent` locally under the chat agent id, so no runtime is contacted. */
export function provideFakeChatAgent(agent: FakeChatAgent): Provider[] {
  return [
    ...provideFakeAuth(),
    provideCopilotKit({ agents: { [CHAT_AGENT_ID]: agent } }),
  ];
}

/** Events of a run that streams `chunks` as one assistant message. */
export function textReply(
  input: RunAgentInput,
  ...chunks: string[]
): BaseEvent[] {
  const messageId = `reply-${input.runId}`;
  return [
    runStarted(input),
    { type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' },
    ...chunks.map((delta) => ({
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId,
      delta,
    })),
    { type: EventType.TEXT_MESSAGE_END, messageId },
    runFinished(input),
  ] as BaseEvent[];
}

/**
 * Events of a run in which the assistant calls `toolName` with `args`,
 * receives `result` and answers with `text`. The text goes into a
 * continuation message, as the Mastra adapter streams it.
 */
export function toolCallReply(
  input: RunAgentInput,
  toolName: string,
  args: object,
  result: object,
  text: string,
): BaseEvent[] {
  const messageId = `reply-${input.runId}`;
  const textMessageId = `${messageId}${CONTINUATION_SUFFIX}`;
  const toolCallId = `call-${input.runId}`;
  return [
    runStarted(input),
    {
      type: EventType.TOOL_CALL_START,
      toolCallId,
      toolCallName: toolName,
      parentMessageId: messageId,
    },
    { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify(args) },
    { type: EventType.TOOL_CALL_END, toolCallId },
    {
      type: EventType.TOOL_CALL_RESULT,
      toolCallId,
      messageId: `${toolCallId}-result`,
      content: JSON.stringify(result),
      role: 'tool',
    },
    {
      type: EventType.TEXT_MESSAGE_START,
      messageId: textMessageId,
      role: 'assistant',
    },
    {
      type: EventType.TEXT_MESSAGE_CONTENT,
      messageId: textMessageId,
      delta: text,
    },
    { type: EventType.TEXT_MESSAGE_END, messageId: textMessageId },
    runFinished(input),
  ] as BaseEvent[];
}

/** Events of a run that fails with `message` before answering. */
export function failedRun(input: RunAgentInput, message: string): BaseEvent[] {
  return [
    runStarted(input),
    { type: EventType.RUN_ERROR, message },
  ] as BaseEvent[];
}

function runStarted(input: RunAgentInput): BaseEvent {
  return {
    type: EventType.RUN_STARTED,
    threadId: input.threadId,
    runId: input.runId,
  } as BaseEvent;
}

function runFinished(input: RunAgentInput): BaseEvent {
  return {
    type: EventType.RUN_FINISHED,
    threadId: input.threadId,
    runId: input.runId,
  } as BaseEvent;
}

/** Waits until the store leaves the streaming state or the attempts run out. */
export async function settled(store: { status: () => string }): Promise<void> {
  for (let i = 0; i < 100 && store.status() === 'streaming'; i++) {
    await new Promise((resolve) => setTimeout(resolve));
  }
}
