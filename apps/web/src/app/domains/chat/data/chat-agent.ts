import type { AssistantMessage, Message, UserMessage } from '@ag-ui/client';
import type { CopilotKitCoreErrorCode } from '@copilotkit/core';

/** A failure reported by the AG-UI client while connecting or running. */
export interface ChatAgentError {
  code: CopilotKitCoreErrorCode;
  error: Error;
}

/**
 * Id of the Mastra agent the chat talks to. Part of the contract with
 * `apps/ai` (`CHAT_AGENT_ID` in `src/mastra/agents/chat-agent.ts`).
 */
export const CHAT_AGENT_ID = 'chat';

/**
 * CopilotKit runtime route of the AI service, reached through the `/ai`
 * proxy of the web server (nginx in the cloud, `proxy.conf.json` with
 * `nx serve web`). Part of the contract with `apps/ai` (`COPILOTKIT_PATH`).
 */
export const CHAT_RUNTIME_URL = '/ai/copilotkit';

/**
 * Suffix the Mastra AG-UI adapter appends to a message id when the model
 * writes text after it has already called a tool in the same message: the
 * text goes into a separate "continuation" message.
 */
export const CONTINUATION_SUFFIX = '-agui-text';

/** The turns the transcript shows; tool and system messages stay hidden. */
export type ChatTurn = UserMessage | AssistantMessage;

export function isChatTurn(message: Message): message is ChatTurn {
  return message.role === 'user' || message.role === 'assistant';
}

/** Plain text of a turn. Multimodal user content keeps only its text parts. */
export function textOf(message: ChatTurn): string {
  const { content } = message;
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((part) =>
      'text' in part && typeof part.text === 'string' ? part.text : '',
    )
    .filter(Boolean)
    .join('\n');
}

/**
 * Where a tool call belongs when it was made after the model had already
 * streamed text: tool call id → id of the message holding that text.
 * Recorded from the event stream (see `ChatAgentClient`), because the
 * finished thread no longer carries that order.
 */
export type ToolCallPlacements = ReadonlyMap<string, string>;

/**
 * Restores the order in which things happened in a thread.
 *
 * The Mastra AG-UI adapter attaches every tool call of a run to the run's
 * first assistant message, even a call the model made after it had already
 * streamed text (that text lands in a continuation message), and the AG-UI
 * client groups tool results right behind that message. The transcript then
 * shows the call above the text that introduces it, and the thread ends
 * with a model turn that Gemini rejects on the next run.
 *
 * Every call listed in `placements` is moved to the message it belongs to,
 * together with its result. A thread that needs no change is returned as
 * is (same array).
 */
export function normalizeThread(
  messages: Message[],
  placements: ToolCallPlacements,
): Message[] {
  if (placements.size === 0) {
    return messages;
  }

  // Every assistant message is copied: the input belongs to the agent and is
  // normalised again on each change.
  const result: Message[] = messages.map((message) =>
    message.role === 'assistant'
      ? { ...message, toolCalls: message.toolCalls?.slice() }
      : message,
  );
  const assistants = new Map(
    result
      .filter((m): m is AssistantMessage => m.role === 'assistant')
      .map((m) => [m.id, m]),
  );
  // Tool call id → the assistant message it was moved to.
  const moved = new Map<string, AssistantMessage>();

  for (const message of assistants.values()) {
    for (const call of message.toolCalls ?? []) {
      const target = assistants.get(placements.get(call.id) ?? '');
      if (!target || target === message) {
        continue;
      }
      message.toolCalls = message.toolCalls?.filter((c) => c !== call);
      target.toolCalls = [...(target.toolCalls ?? []), call];
      moved.set(call.id, target);
    }
  }
  if (moved.size === 0) {
    return messages;
  }

  // Tool results follow the message that now owns their call.
  const movedResults = new Map<AssistantMessage, Message[]>();
  const rest: Message[] = [];
  for (const message of result) {
    const target =
      message.role === 'tool' ? moved.get(message.toolCallId) : undefined;
    if (target) {
      movedResults.set(target, [...(movedResults.get(target) ?? []), message]);
    } else {
      rest.push(message);
    }
  }

  return rest.flatMap((message) => {
    if (message.role !== 'assistant') {
      return [message];
    }
    if (textOf(message) === '' && !message.toolCalls?.length) {
      return [];
    }
    return [message, ...(movedResults.get(message) ?? [])];
  });
}
