import type { AbstractAgent, Message } from '@ag-ui/client';
import {
  computed,
  inject,
  Injectable,
  LOCALE_ID,
  Signal,
  signal,
} from '@angular/core';
import { CopilotKit, injectAgentStore } from '@copilotkit/angular';
import { CopilotKitCoreErrorCode } from '@copilotkit/core';

import { SESSION } from '../../auth/api/session';
import { createId } from '../util/create-id';
import {
  BEFORE_CHAT_REQUEST,
  CHAT_AGENT_ID,
  ChatAgentError,
  type ChatRunOptions,
  CONTINUATION_SUFFIX,
  creditsErrorOf,
  normalizeThread,
  ToolCallPlacements,
} from './chat-agent';
import {
  CHAT_EFFORT_PROPERTY,
  CHAT_LOCALE_PROPERTY,
  CHAT_MODE_PROPERTY,
  CHAT_ROLE_MODELS_PROPERTY,
} from './chat-model';
import { comparisonSelection } from './comparison-selection';
import { IngestionActivity } from './ingestion-activity';

const RUN_ERROR_CODES = new Set([
  CopilotKitCoreErrorCode.AGENT_RUN_FAILED,
  CopilotKitCoreErrorCode.AGENT_RUN_FAILED_EVENT,
  CopilotKitCoreErrorCode.AGENT_RUN_ERROR_EVENT,
  CopilotKitCoreErrorCode.AGENT_THREAD_LOCKED,
]);

/**
 * Data access for the chat agent. It is a thin adapter over the AG-UI client
 * (CopilotKit): it uses the authenticated runtime, hands the agent store to the
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
  private readonly session = inject(SESSION);
  private readonly authenticate = inject(BEFORE_CHAT_REQUEST);
  private readonly copilotKit = inject(CopilotKit);
  private readonly ingestion = inject(IngestionActivity);
  private readonly locale = inject(LOCALE_ID);
  private readonly agentStore = injectAgentStore(CHAT_AGENT_ID);
  private readonly _placements = signal<Map<string, string>>(new Map());
  private readonly _threadId = signal(createId());

  private readonly available = computed(
    () =>
      this.session.authenticated() &&
      (Boolean(this.copilotKit.runtimeUrl()) ||
        Boolean(this.copilotKit.agents()[CHAT_AGENT_ID])),
  );

  /** Id of the thread the agent currently holds; changes on `reset` and `load`. */
  readonly threadId: Signal<string> = this._threadId;

  /** Every message of the thread, tool results included, as the agent holds them. */
  readonly messages: Signal<Message[]> = computed(() =>
    this.available() ? this.agentStore().messages() : [],
  );

  /** True while a run streams; mirrors the AG-UI agent. */
  readonly isRunning: Signal<boolean> = computed(
    () => this.available() && this.agentStore().isRunning(),
  );

  /**
   * Tool calls the model made after it had streamed text, keyed by call id,
   * with the message that holds that text. Feed it to `normalizeThread` to
   * show the thread in the order things happened.
   */
  readonly placements: Signal<ToolCallPlacements> = this._placements;

  /** Agents whose event stream is already watched (the proxy may be replaced). */
  private activeAgent?: AbstractAgent;
  private readonly tracked = new WeakSet<AbstractAgent>();
  private requestGeneration = 0;
  private executingGeneration?: number;
  private runtimeRun?: Promise<void>;

  /** Appends the user's turn to the thread without running the agent. */
  append(content: string): void {
    const agent = this.agentStore().agent;
    this.activeAgent = agent;
    agent.threadId = this._threadId();
    agent.addMessage({
      id: createId(),
      role: 'user',
      content,
    });
  }

  /**
   * Runs the agent on the current thread. Resolves when the run ends, also
   * after a failure: errors are reported through {@link onError}. `options`
   * name the mode, the per-role overrides and the reasoning effort the
   * service should answer with.
   */
  send(options: ChatRunOptions = {}): Promise<void> {
    return this.run(this.agentStore().agent, options);
  }

  /**
   * Drops everything the agent produced after the last user turn and runs
   * it again for that turn. Does nothing while the thread has no user turn.
   * A failed run leaves no assistant turn, so this also retries it.
   */
  async regenerate(options: ChatRunOptions = {}): Promise<void> {
    const agent = this.agentStore().agent;
    const lastUser = lastIndexOfRole(agent.messages, 'user');
    if (lastUser < 0) {
      return;
    }
    if (lastUser < agent.messages.length - 1) {
      agent.setMessages(agent.messages.slice(0, lastUser + 1));
    }
    await this.run(agent, options);
  }

  /** Aborts the run in flight and keeps whatever arrived so far. */
  stop(): void {
    this.requestGeneration++;
    const agent = this.activeAgent;
    if (agent) {
      this.copilotKit.core.stopAgent({ agent });
      // A stopped thread may be cached or sent again before its old run
      // resolves. Preserve the tool ordering already received at cancellation.
      const normalized = normalizeThread(agent.messages, this._placements());
      if (normalized !== agent.messages) agent.setMessages(normalized);
    }
  }

  /** Clears the thread and starts a new one. */
  reset(): void {
    this.stop();
    this.activeAgent?.setMessages([]);
    this.activeAgent?.setState({});
    this.load(createId(), []);
  }

  /** Replaces the thread with a stored one, e.g. when the user reopens it. */
  load(threadId: string, messages: Message[]): void {
    this.stop();
    this._placements.set(new Map());
    this._threadId.set(threadId);
    if (!this.available()) return;
    const agent = this.agentStore().agent;
    this.activeAgent = agent;
    agent.threadId = threadId;
    agent.setMessages(messages);
    const selection = comparisonSelection(messages);
    agent.setState(selection ? { comparison: selection } : {});
  }

  /** Appends server-persisted completion messages without restarting the model or replacing the transcript. */
  appendPersisted(messages: Message[]): void {
    if (!this.available() || this.isRunning()) return;
    const agent = this.agentStore().agent;
    const ids = new Set(agent.messages.map((message) => message.id));
    for (const message of messages) {
      if (!ids.has(message.id)) {
        agent.addMessage(message);
        ids.add(message.id);
      }
    }
  }

  /** Subscribes to client failures. Returns the function that unsubscribes. */
  onError(handler: (error: ChatAgentError) => void): () => void {
    const subscription = this.copilotKit.core.subscribe({
      onError: ({ code, error, context }) => {
        if (
          this.available() &&
          (!context['agentId'] || context['agentId'] === CHAT_AGENT_ID) &&
          (!RUN_ERROR_CODES.has(code) ||
            this.executingGeneration === this.requestGeneration)
        )
          handler({ code, error, credits: creditsErrorOf(error?.message) });
      },
    });
    return () => subscription.unsubscribe();
  }

  /**
   * Runs the agent on its current thread. The mode, the advanced per-role
   * overrides and the effort travel as AG-UI forwarded properties (see
   * `CHAT_MODE_PROPERTY`, `CHAT_ROLE_MODELS_PROPERTY` and
   * `CHAT_EFFORT_PROPERTY`). The thread is
   * normalised afterwards (see `normalizeThread`) so the next run sends the
   * model the sequence in which things happened.
   */
  private async run(
    agent: AbstractAgent,
    options: ChatRunOptions,
  ): Promise<void> {
    const generation = ++this.requestGeneration;
    const threadId = this._threadId();
    this.activeAgent = agent;
    const scope = this.session.scope();
    if (!scope) throw new Error('Sign in to continue.');
    const current = () =>
      generation === this.requestGeneration &&
      threadId === this._threadId() &&
      this.session.isCurrent(scope);
    await this.authenticate();
    if (!current()) return;
    // An aborted transport can still be unwinding. Do not start another run
    // on the shared agent until its previous execution has released it.
    await this.runtimeRun?.catch(() => undefined);
    if (!current()) return;
    this.track(agent);
    const selection = comparisonSelection(agent.messages);
    agent.setState(selection ? { comparison: selection } : {});
    const contextIds = [
      this.copilotKit.core.addContext({
        description:
          'SpecSync comparison selection (last successful structured tool result)',
        value: JSON.stringify(selection ?? null),
        agentIds: [CHAT_AGENT_ID],
      }),
    ];
    const runs = this.ingestion.runs();
    if (runs.length)
      contextIds.push(
        this.copilotKit.core.addContext({
          description:
            'SpecSync specification imports started or opened in this browser session (persisted status, no credentials)',
          value: JSON.stringify(runs),
          agentIds: [CHAT_AGENT_ID],
        }),
      );
    this.executingGeneration = generation;
    const running = this.copilotKit.core
      .runAgent({
        agent,
        forwardedProps: forwardedPropsOf(options, this.locale),
      })
      .then(() => undefined)
      .finally(() => {
        for (const contextId of contextIds)
          this.copilotKit.core.removeContext(contextId);
        if (this.executingGeneration === generation)
          this.executingGeneration = undefined;
      });
    this.runtimeRun = running;
    try {
      await running;
    } finally {
      if (this.runtimeRun === running) this.runtimeRun = undefined;
    }
    if (!current()) return;
    const nextSelection = comparisonSelection(agent.messages);
    agent.setState(nextSelection ? { comparison: nextSelection } : {});
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
          this._placements.update((placements) =>
            new Map(placements).set(event.toolCallId, host),
          );
        }
      },
    };
  }
}

/**
 * The run options as forwarded properties. The locale always travels with a
 * run, so the agent answers in the language the interface is running in.
 */
function forwardedPropsOf(
  options: ChatRunOptions,
  locale: string,
): Record<string, unknown> | undefined {
  const props: Record<string, unknown> = { [CHAT_LOCALE_PROPERTY]: locale };
  if (options.mode) props[CHAT_MODE_PROPERTY] = options.mode;
  if (options.roleModels && Object.keys(options.roleModels).length)
    props[CHAT_ROLE_MODELS_PROPERTY] = options.roleModels;
  if (options.effort) props[CHAT_EFFORT_PROPERTY] = options.effort;
  return props;
}

function lastIndexOfRole(messages: Message[], role: Message['role']): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === role) {
      return i;
    }
  }
  return -1;
}
