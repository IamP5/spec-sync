import type { AbstractAgent, Message } from '@ag-ui/client';
import type { CopilotKitCore } from '@copilotkit/core';

import { createId } from '../util/create-id';
import {
  CHAT_AGENT_ID,
  CHAT_LOCALE,
  type ChatAgentError,
  type ChatRunOptions,
  CONTINUATION_SUFFIX,
  creditsErrorOf,
  normalizeThread,
  type ToolCallPlacements,
} from './chat-agent';
import {
  CHAT_EFFORT_PROPERTY,
  CHAT_LOCALE_PROPERTY,
  CHAT_MODE_PROPERTY,
} from './chat-model';
import { comparisonSelection } from './comparison-selection';

/** CopilotKit error codes of a run (`CopilotKitCoreErrorCode` values). */
const RUN_ERROR_CODES = new Set<string>([
  'agent_run_failed',
  'agent_run_failed_event',
  'agent_run_error_event',
  'agent_thread_locked',
]);

/**
 * Data access for the chat agent (a port of the web `ChatAgentClient`): it
 * translates send / regenerate / stop / reset / load into AG-UI agent runs on
 * the CopilotKit core the store hands in. The AG-UI agent holds the
 * conversation; this object keeps only what the event stream reveals and the
 * finished thread no longer carries (tool call placements), plus the run
 * generation that tells a current run from a superseded one.
 *
 * It is one instance for the app, so a screen remount keeps the thread.
 */
export class ChatAgentClient {
  private placementMap = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private readonly tracked = new WeakSet<AbstractAgent>();
  private requestGeneration = 0;
  private executingGeneration: number | undefined;
  private runtimeRun: Promise<void> | undefined;
  private activeAgent: AbstractAgent | undefined;
  private currentThreadId = createId();

  /** Id of the thread the agent holds; changes on `reset` and `load`. */
  get threadId(): string {
    return this.currentThreadId;
  }

  /** See `normalizeThread`. */
  get placements(): ToolCallPlacements {
    return this.placementMap;
  }

  /** Notified when the thread id or the placements change. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Appends the user's turn to the thread without running the agent. */
  append(agent: AbstractAgent, content: string): void {
    this.activeAgent = agent;
    agent.threadId = this.currentThreadId;
    agent.addMessage({ id: createId(), role: 'user', content });
  }

  /**
   * Runs the agent on the current thread. Resolves when the run ends, also
   * after a failure (errors arrive through `onError`). `authenticate` puts a
   * fresh ID token on the runtime; `current` says whether the session that
   * started the run is still the signed-in one.
   */
  async run(
    core: CopilotKitCore,
    agent: AbstractAgent,
    options: ChatRunOptions,
    authenticate: () => Promise<void>,
    current: () => boolean,
  ): Promise<void> {
    const generation = ++this.requestGeneration;
    const threadId = this.currentThreadId;
    this.activeAgent = agent;
    const live = () =>
      generation === this.requestGeneration &&
      threadId === this.currentThreadId &&
      current();
    await authenticate();
    if (!live()) return;
    // An aborted transport can still be unwinding; wait until it released
    // the shared agent before starting another run on it.
    await this.runtimeRun?.catch(() => undefined);
    if (!live()) return;
    this.track(agent);
    const selection = comparisonSelection(agent.messages);
    agent.setState(selection ? { comparison: selection } : {});
    const contextId = core.addContext({
      description:
        'SpecSync comparison selection (last successful structured tool result)',
      value: JSON.stringify(selection ?? null),
      agentIds: [CHAT_AGENT_ID],
    });
    this.executingGeneration = generation;
    const running = core
      .runAgent({ agent, forwardedProps: forwardedPropsOf(options) })
      .then(() => undefined)
      .finally(() => {
        core.removeContext(contextId);
        if (this.executingGeneration === generation) {
          this.executingGeneration = undefined;
        }
      });
    this.runtimeRun = running;
    try {
      await running;
    } finally {
      if (this.runtimeRun === running) this.runtimeRun = undefined;
    }
    if (!live()) return;
    const next = comparisonSelection(agent.messages);
    agent.setState(next ? { comparison: next } : {});
    const normalized = normalizeThread(agent.messages, this.placementMap);
    if (normalized !== agent.messages) agent.setMessages(normalized);
  }

  /**
   * Drops everything after the last user turn and runs that turn again. A
   * failed run leaves no assistant turn, so this also retries it.
   */
  async regenerate(
    core: CopilotKitCore,
    agent: AbstractAgent,
    options: ChatRunOptions,
    authenticate: () => Promise<void>,
    current: () => boolean,
  ): Promise<void> {
    const lastUser = lastIndexOfRole(agent.messages, 'user');
    if (lastUser < 0) return;
    if (lastUser < agent.messages.length - 1) {
      agent.setMessages(agent.messages.slice(0, lastUser + 1));
    }
    await this.run(core, agent, options, authenticate, current);
  }

  /** Aborts the run in flight and keeps whatever arrived so far. */
  stop(core: CopilotKitCore): void {
    this.requestGeneration++;
    const agent = this.activeAgent;
    if (!agent) return;
    core.stopAgent({ agent });
    const normalized = normalizeThread(agent.messages, this.placementMap);
    if (normalized !== agent.messages) agent.setMessages(normalized);
  }

  /** Clears the thread and starts a new one. */
  reset(core: CopilotKitCore, agent: AbstractAgent): void {
    this.load(core, agent, createId(), []);
  }

  /** Replaces the thread with a stored one, e.g. when the user reopens it. */
  load(
    core: CopilotKitCore,
    agent: AbstractAgent,
    threadId: string,
    messages: Message[],
  ): void {
    this.stop(core);
    this.activeAgent = agent;
    this.placementMap = new Map();
    this.currentThreadId = threadId;
    agent.threadId = threadId;
    agent.setMessages(messages);
    const selection = comparisonSelection(messages);
    agent.setState(selection ? { comparison: selection } : {});
    this.notify();
  }

  /** Adds server-persisted messages (research completions) not yet in the thread. */
  appendPersisted(agent: AbstractAgent, messages: Message[]): void {
    if (agent.isRunning) return;
    const ids = new Set(agent.messages.map((message) => message.id));
    for (const message of messages) {
      if (!ids.has(message.id)) {
        agent.addMessage(message);
        ids.add(message.id);
      }
    }
  }

  /** Client failures of the chat agent. Returns the unsubscribe function. */
  onError(
    core: CopilotKitCore,
    handler: (error: ChatAgentError) => void,
  ): () => void {
    const subscription = core.subscribe({
      onError: ({ code, error, context }) => {
        const agentId = context['agentId'];
        if (
          (!agentId || agentId === CHAT_AGENT_ID) &&
          (!RUN_ERROR_CODES.has(code) ||
            this.executingGeneration === this.requestGeneration)
        ) {
          handler({ code, error, credits: creditsErrorOf(error?.message) });
        }
      },
    });
    return () => subscription.unsubscribe();
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }

  private track(agent: AbstractAgent): void {
    if (this.tracked.has(agent)) return;
    this.tracked.add(agent);
    agent.subscribe(this.placementTracker());
  }

  /**
   * Watches the event stream of a run: once a continuation message started,
   * every later tool call on its parent message belongs behind it.
   */
  private placementTracker() {
    const continuations = new Map<string, string>();
    let generation = this.requestGeneration;
    return {
      onRunStartedEvent: () => {
        generation = this.requestGeneration;
        continuations.clear();
      },
      onTextMessageStartEvent: ({
        event,
      }: {
        event: { messageId: string };
      }) => {
        if (
          generation === this.requestGeneration &&
          event.messageId.endsWith(CONTINUATION_SUFFIX)
        ) {
          continuations.set(
            event.messageId.slice(0, -CONTINUATION_SUFFIX.length),
            event.messageId,
          );
        }
      },
      onToolCallStartEvent: ({
        event,
      }: {
        event: { toolCallId: string; parentMessageId?: string };
      }) => {
        if (generation !== this.requestGeneration) return;
        const host = continuations.get(event.parentMessageId ?? '');
        if (host) {
          this.placementMap = new Map(this.placementMap).set(
            event.toolCallId,
            host,
          );
          this.notify();
        }
      },
    };
  }
}

/** The one agent client of the app. */
export const chatAgentClient = new ChatAgentClient();

/** The run options as AG-UI forwarded properties; the locale always travels. */
export function forwardedPropsOf(
  options: ChatRunOptions,
): Record<string, unknown> {
  const props: Record<string, unknown> = {
    [CHAT_LOCALE_PROPERTY]: CHAT_LOCALE,
  };
  if (options.mode) props[CHAT_MODE_PROPERTY] = options.mode;
  if (options.effort) props[CHAT_EFFORT_PROPERTY] = options.effort;
  return props;
}

function lastIndexOfRole(messages: Message[], role: Message['role']): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === role) return index;
  }
  return -1;
}
