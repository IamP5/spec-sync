import type {
  AssistantMessage,
  Message,
  ReasoningMessage,
  UserMessage,
} from '@ag-ui/client';
import { InjectionToken } from '@angular/core';
import type { CopilotKitCoreErrorCode } from '@copilotkit/core';

import type { ChatMode, RoleModels } from './chat-model';

/**
 * How the service should answer a run: the mode it answers in, the advanced
 * per-role overrides and the reasoning effort, all from the model catalog
 * (`chat-model.ts`). An empty or missing value leaves the choice to the
 * service, which answers in its default mode.
 */
export interface ChatRunOptions {
  mode?: ChatMode | '';
  roleModels?: RoleModels;
  effort?: string;
}

/**
 * Why a run was rejected before it started, taken from the AG-UI `RUN_ERROR`
 * message. Part of the contract with `apps/ai`: the credits module throws
 * `<CODE>: <human text>` from the model resolver, so the code is the leading
 * token of the message and the rest is shown to the user unchanged.
 */
export type ChatCreditsErrorCode =
  | 'INSUFFICIENT_CREDITS'
  | 'CREDITS_UNAVAILABLE';

export interface ChatCreditsError {
  code: ChatCreditsErrorCode;
  /** The service's own sentence; the browser adds no wording of its own. */
  message: string;
}

const CREDITS_ERROR =
  /\b(INSUFFICIENT_CREDITS|CREDITS_UNAVAILABLE):[ \t]*([\s\S]*)$/;

/**
 * The credits rejection carried by a run failure, or nothing when the failure
 * has another cause. The AG-UI client wraps the streamed message in an
 * `Error`, sometimes behind a prefix of its own, so the code is looked for as
 * a token rather than only at position zero.
 */
export function creditsErrorOf(
  message: string | undefined,
): ChatCreditsError | undefined {
  const match = message?.match(CREDITS_ERROR);
  if (!match) {
    return undefined;
  }
  return {
    code: match[1] as ChatCreditsErrorCode,
    message: match[2].trim(),
  };
}

/** A failure reported by the AG-UI client while connecting or running. */
export interface ChatAgentError {
  code: CopilotKitCoreErrorCode;
  error: Error;
  /** Set when the AI service refused the run for lack of credits. */
  credits?: ChatCreditsError;
}

/**
 * Id of the Mastra agent the chat talks to. Part of the contract with
 * `apps/ai` (`CHAT_AGENT_ID` in `src/mastra/agents/spec-sync-agent.ts`).
 */
export const CHAT_AGENT_ID = 'chat';

/** The shell supplies authentication before each remote run; local test agents need none. */
export const BEFORE_CHAT_REQUEST = new InjectionToken<() => Promise<void>>(
  'beforeChatRequest',
  { providedIn: 'root', factory: () => async () => undefined },
);

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

/** Transcript entries, including provider thinking summaries; tool results render in cards. */
export type ChatTurn = UserMessage | AssistantMessage | ReasoningMessage;

export function isChatTurn(message: Message): message is ChatTurn {
  return (
    message.role === 'user' ||
    message.role === 'assistant' ||
    message.role === 'reasoning'
  );
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

/** Inspectable tool activity, separate from the useful output cards. */
export function toolActivities(messages: Message[], running: boolean) {
  const results = new Map(
    messages
      .filter((message) => message.role === 'tool')
      .map((message) => [message.toolCallId, message]),
  );
  const lastUserIndex = messages.reduce(
    (last, message, index) => (message.role === 'user' ? index : last),
    -1,
  );
  return new Map(
    messages.flatMap((message, index) =>
      message.role === 'assistant'
        ? [
            [
              message.id,
              (message.toolCalls ?? []).map((call) => {
                const result = results.get(call.id);
                return {
                  id: call.id,
                  name: call.function.name,
                  label: call.function.name,
                  status: result
                    ? toolOutcome(
                        result.content,
                        !!result.error,
                        call.function.name,
                      )
                    : running && index > lastUserIndex
                      ? 'Running'
                      : 'Incomplete',
                  input: formatToolData(call.function.arguments),
                  result: result ? formatToolData(result.content) : '',
                };
              }),
            ] as const,
          ]
        : [],
    ),
  );
}

function formatToolData(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    // Arguments arrive incrementally and may not yet be valid JSON.
    return value;
  }
}

function toolOutcome(content: string, error: boolean, name: string): string {
  if (error) return 'Failed';
  try {
    const data: unknown = JSON.parse(content);
    if (data && typeof data === 'object') {
      const status = 'status' in data ? data.status : undefined;
      if (status === 'EMPTY') return 'No matches';
      if (status === 'ERROR' || status === 'UNAVAILABLE' || status === 'FAILED')
        return 'Failed';
      if (
        name === 'searchVehicleConfigurations' &&
        'items' in data &&
        Array.isArray(data.items) &&
        !data.items.length
      )
        return 'No matches';
    }
  } catch {
    // A completed tool may legitimately return plain text.
  }
  return 'Completed';
}
