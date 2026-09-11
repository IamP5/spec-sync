import {
  type BaseEvent,
  EventType,
  type Message,
  type RunAgentInput,
} from '@ag-ui/core';
import { MastraAgent, type MastraAgentConfig } from '@ag-ui/mastra';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { defer, from, type Observable, switchMap } from 'rxjs';

import {
  COMPETITIVE_ACTION_CONTEXT,
  validateCompetitiveAction,
} from '../workspace/competitive-history';

/** Keeps persisted server results out of the bridge's message-ID-only replay selector. */
export class HistorySafeMastraAgent extends MastraAgent {
  constructor(private readonly initialConfig: MastraAgentConfig) {
    super(initialConfig);
  }

  override clone(): HistorySafeMastraAgent {
    const clone = new HistorySafeMastraAgent(this.initialConfig);
    if (this.headers) clone.headers = { ...this.headers };
    return clone;
  }

  override run(input: RunAgentInput): Observable<BaseEvent> {
    return defer(async () => {
      if (!this.isLocalMastraAgent(this.agent) || !this.resourceId)
        throw new Error(
          'Chat history requires a local agent and verified resource.',
        );
      const memory = await this.agent.getMemory({
        requestContext: this.requestContext,
      });
      if (!memory) throw new Error('Chat memory is unavailable.');
      const thread = await memory.getThreadById({ threadId: input.threadId });
      if (thread && thread.resourceId !== this.resourceId)
        throw new Error('Chat thread does not belong to the verified user.');
      const { messages } = thread
        ? await memory.recall({
            threadId: input.threadId,
            resourceId: this.resourceId,
            perPage: false,
          })
        : { messages: [] };
      const freshMessages = newRunMessages(input.messages, messages);
      this.requestContext?.delete(COMPETITIVE_ACTION_CONTEXT);
      const props: unknown = input.forwardedProps;
      if (
        props &&
        typeof props === 'object' &&
        'workspaceAction' in props &&
        props.workspaceAction !== undefined
      ) {
        const action = validateCompetitiveAction(
          props.workspaceAction,
          messages,
        );
        action.currentUserMessageId = freshMessages.findLast(
          (message) => message.role === 'user',
        )?.id;
        this.requestContext?.set(COMPETITIVE_ACTION_CONTEXT, action);
      }
      return freshMessages;
    }).pipe(
      switchMap((messages) =>
        messages.length || isResume(input)
          ? super.run({ ...input, messages })
          : from<BaseEvent[]>([
              {
                type: EventType.RUN_STARTED,
                threadId: input.threadId,
                runId: input.runId,
              },
              {
                type: EventType.RUN_FINISHED,
                threadId: input.threadId,
                runId: input.runId,
              },
            ]),
      ),
    );
  }
}

export function newRunMessages(
  incoming: Message[],
  stored: MastraDBMessage[],
): Message[] {
  const known = new Set(
    stored.flatMap((message) => [message.id, `${message.id}-agui-text`]),
  );
  const completed = new Set(
    stored.flatMap((message) =>
      (message.content.parts ?? []).flatMap((part) =>
        part.type === 'tool-invocation' &&
        part.toolInvocation.state === 'result'
          ? [part.toolInvocation.toolCallId]
          : [],
      ),
    ),
  );
  const fresh = incoming.filter((message) =>
    message.role === 'tool'
      ? !completed.has(message.toolCallId)
      : message.role !== 'reasoning' &&
        message.role !== 'activity' &&
        !known.has(message.id),
  );
  // Regenerate/ retry sends a transcript truncated at its user message. Keep
  // that single prompt, never the full stored assistant/result history.
  if (!fresh.length) {
    const last = incoming.at(-1);
    return last?.role === 'user' ? [last] : [];
  }
  const pending = new Set(
    fresh.flatMap((message) =>
      message.role === 'tool' ? [message.toolCallId] : [],
    ),
  );
  const freshIds = new Set(fresh.map((message) => message.id));
  return incoming.flatMap((message): Message[] => {
    if (freshIds.has(message.id)) return [message];
    if (message.role !== 'assistant') return [];
    const calls = message.toolCalls?.filter((call) => pending.has(call.id));
    // A pending browser result must retain its call; unrelated historical
    // calls and narration must not be replayed with it.
    return calls?.length ? [{ ...message, content: '', toolCalls: calls }] : [];
  });
}

function isResume(input: RunAgentInput): boolean {
  if (
    input.resume?.some(
      (entry) => entry.status === 'resolved' || entry.status === 'cancelled',
    )
  )
    return true;
  const props: unknown = input.forwardedProps;
  if (!props || typeof props !== 'object' || !('command' in props))
    return false;
  const command: unknown = props.command;
  return (
    !!command && typeof command === 'object' && 'interruptEvent' in command
  );
}
