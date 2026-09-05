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
 * conversation store and translates send / stop / reset into agent runs.
 * It holds no conversation state of its own; the AG-UI agent does, and the
 * store mirrors it as signals.
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

  /**
   * Appends the user's turn and runs the agent. Resolves when the run ends,
   * also after a failure: errors are reported through {@link onError}.
   *
   * The thread is normalised afterwards (see `normalizeThread`) so the next
   * run sends the model the sequence in which things happened.
   */
  async send(content: string): Promise<void> {
    const agent = this.agentStore().agent;
    this.track(agent);
    agent.addMessage({ id: createId(), role: 'user', content });
    await this.copilotKit.core.runAgent({ agent });
    const normalized = normalizeThread(agent.messages, this._placements());
    if (normalized !== agent.messages) {
      agent.setMessages(normalized);
    }
  }

  /** Aborts the run in flight and keeps whatever arrived so far. */
  stop(): void {
    this.copilotKit.core.stopAgent({ agent: this.agentStore().agent });
  }

  /** Clears the thread and starts a new one. */
  reset(): void {
    const agent = this.agentStore().agent;
    agent.threadId = createId();
    agent.setMessages([]);
    agent.setState({});
    this._placements.set(new Map());
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
