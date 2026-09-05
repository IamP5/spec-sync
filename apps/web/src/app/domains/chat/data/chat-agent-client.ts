import type { AbstractAgent, Message } from '@ag-ui/client';
import { computed, inject, Injectable, Signal, signal } from '@angular/core';
import { CopilotKit, injectAgentStore } from '@copilotkit/angular';

import { createId } from '../util/create-id';
import {
  CHAT_AGENT_ID,
  CHAT_RUNTIME_URL,
  ChatAgentError,
  CONTINUATION_SUFFIX,
  normalizeThread,
  ToolCallPlacements,
} from './chat-agent';

/**
 * Data access for the chat agent. It is a thin adapter over the AG-UI client
 * (CopilotKit): it connects the runtime, hands the agent store to the
 * conversation store and translates send / regenerate / stop / reset into
 * agent runs. It holds no conversation state of its own; the AG-UI agent
 * does, and the store mirrors it as signals.
 *
 * The agent is normally a proxy to the CopilotKit runtime of `apps/ai`.
 * Tests register a local agent under the same id instead, in which case the
 * runtime is left untouched.
 */
@Injectable({ providedIn: 'root' })
export class ChatAgentClient {
  private readonly copilotKit = inject(CopilotKit);
  private readonly agentStore = connectChatAgent(this.copilotKit);
  private readonly _placements = signal<Map<string, string>>(new Map());
  private readonly _threadId = signal(this.agentStore().agent.threadId);

  /** Id of the thread the agent currently holds; changes on `reset` and `load`. */
  readonly threadId: Signal<string> = this._threadId;

  /** Every message of the thread, tool results included, as the agent holds them. */
  readonly messages: Signal<Message[]> = computed(() =>
    this.agentStore().messages(),
  );

  /** True while a run streams; mirrors the AG-UI agent. */
  readonly isRunning: Signal<boolean> = computed(() =>
    this.agentStore().isRunning(),
  );

  /**
   * Tool calls the model made after it had streamed text, keyed by call id,
   * with the message that holds that text. Feed it to `normalizeThread` to
   * show the thread in the order things happened.
   */
  readonly placements: Signal<ToolCallPlacements> = this._placements;

  /** Agents whose event stream is already watched (the proxy may be replaced). */
  private readonly tracked = new WeakSet<AbstractAgent>();

  /** Appends the user's turn to the thread without running the agent. */
  append(content: string): void {
    this.agentStore().agent.addMessage({
      id: createId(),
      role: 'user',
      content,
    });
  }

  /**
   * The thread as the agent holds it right now. The `messages` signal
   * follows on the next tick; use this to persist right after a change.
   */
  snapshot(): Message[] {
    return this.agentStore().agent.messages;
  }

  /**
   * Runs the agent on the current thread. Resolves when the run ends, also
   * after a failure: errors are reported through {@link onError}.
   */
  send(): Promise<void> {
    return this.run(this.agentStore().agent);
  }

  /**
   * Drops everything the agent produced after the last user turn and runs
   * it again for that turn. Does nothing while the thread has no user turn.
   * A failed run leaves no assistant turn, so this also retries it.
   */
  async regenerate(): Promise<void> {
    const agent = this.agentStore().agent;
    const lastUser = lastIndexOfRole(agent.messages, 'user');
    if (lastUser < 0) {
      return;
    }
    if (lastUser < agent.messages.length - 1) {
      agent.setMessages(agent.messages.slice(0, lastUser + 1));
    }
    await this.run(agent);
  }

  /** Aborts the run in flight and keeps whatever arrived so far. */
  stop(): void {
    this.copilotKit.core.stopAgent({ agent: this.agentStore().agent });
  }

  /** Clears the thread and starts a new one. */
  reset(): void {
    this.load(createId(), []);
  }

  /** Replaces the thread with a stored one, e.g. when the user reopens it. */
  load(threadId: string, messages: Message[]): void {
    const agent = this.agentStore().agent;
    agent.threadId = threadId;
    agent.setMessages(messages);
    agent.setState({});
    this._placements.set(new Map());
    this._threadId.set(threadId);
  }

  /** Subscribes to client failures. Returns the function that unsubscribes. */
  onError(handler: (error: ChatAgentError) => void): () => void {
    const subscription = this.copilotKit.core.subscribe({
      onError: ({ code, error }) => {
        handler({ code, error });
      },
    });
    return () => subscription.unsubscribe();
  }

  /**
   * Runs the agent on its current thread. The thread is normalised afterwards
   * (see `normalizeThread`) so the next run sends the model the sequence in
   * which things happened.
   */
  private async run(agent: AbstractAgent): Promise<void> {
    this.track(agent);
    await this.copilotKit.core.runAgent({ agent });
    const normalized = normalizeThread(agent.messages, this._placements());
    if (normalized !== agent.messages) {
      agent.setMessages(normalized);
    }
  }

  private track(agent: AbstractAgent): void {
    if (!this.tracked.has(agent)) {
      this.tracked.add(agent);
      agent.subscribe(this.placementTracker());
    }
  }

  /**
   * Watches the event stream of a run: once a continuation message has
   * started, every later tool call on its parent message belongs behind it.
   */
  private placementTracker() {
    // Parent message id → continuation message id, for the current run.
    const continuations = new Map<string, string>();
    return {
      onRunStartedEvent: () => {
        continuations.clear();
      },
      onTextMessageStartEvent: ({
        event,
      }: {
        event: { messageId: string };
      }) => {
        if (event.messageId.endsWith(CONTINUATION_SUFFIX)) {
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
        const host = continuations.get(event.parentMessageId ?? '');
        if (host) {
          this._placements.update((placements) =>
            new Map(placements).set(event.toolCallId, host),
          );
        }
      },
    };
  }
}

function lastIndexOfRole(messages: Message[], role: Message['role']): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === role) {
      return i;
    }
  }
  return -1;
}

/**
 * Points the AG-UI client at the runtime unless an agent with the chat id is
 * already registered locally, then resolves its store.
 */
function connectChatAgent(copilotKit: CopilotKit) {
  if (!copilotKit.getAgent(CHAT_AGENT_ID) && !copilotKit.runtimeUrl()) {
    copilotKit.updateRuntime({ runtimeUrl: CHAT_RUNTIME_URL });
  }
  return injectAgentStore(CHAT_AGENT_ID);
}
