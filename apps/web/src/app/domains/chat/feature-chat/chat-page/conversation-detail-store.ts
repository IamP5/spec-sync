import type { Message } from '@ag-ui/client';
import { computed, DestroyRef, effect, inject, untracked } from '@angular/core';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { CopilotKitCoreErrorCode } from '@copilotkit/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import {
  Events,
  injectDispatch,
  on,
  withEventHandlers,
  withReducer,
} from '@ngrx/signals/events';
import { firstValueFrom, ignoreElements, tap } from 'rxjs';

import { sessionEvents } from '../../../auth/api/events';
import { SESSION } from '../../../auth/api/session';
import {
  ChatAgentError,
  type ChatRunOptions,
  creditsErrorOf,
  isChatTurn,
  normalizeThread,
  toolActivities,
} from '../../data/chat-agent';
import { ChatAgentClient } from '../../data/chat-agent-client';
import { ChatThread, threadTitleOf } from '../../data/thread';
import { ThreadClient } from '../../data/thread-client';
import { threadEvents } from '../../data/thread-events';
import { toolPresentation } from '../tool-presentation';

export type ConversationStatus = 'idle' | 'streaming' | 'error';

/** Tools whose result subscribes the thread to a research the service announces later. */
const researchTools = new Set([
  'researchVehicleSpecifications',
  'getVehicleResearch',
  'replayVehicleResearch',
  'reviewVehicleResearch',
]);

function hasResearchCall(messages: Message[]): boolean {
  return messages.some(
    (message) =>
      message.role === 'assistant' &&
      (message.toolCalls ?? []).some((call) =>
        researchTools.has(call.function.name),
      ),
  );
}

/**
 * Detail store of the conversation shown on the chat page. The AI service
 * persists every turn in Mastra memory as the run happens, so nothing here
 * writes the history; the AG-UI agent holds the messages for display and the
 * store mirrors them as signals, adding what the page needs on top: the run
 * status, the last error, whether the last reply was cut short and the turns
 * worth showing.
 *
 * Reopening a thread reads it back from the service (`ThreadClient`) the
 * first time; the threads opened in this session are kept (`_threads`) so
 * switching back to one is instant. The conversation left behind is put
 * there with the messages the agent held, which the service holds too. A run
 * is a stream of AG-UI events rather than a request/response pair, so it is
 * driven by `send()` instead of `withResource` / `withMutations`.
 *
 * The store announces what it knows about the history (`threadEvents`): the
 * first message starts a thread, and every run makes its thread the most
 * recent one. The thread list updates itself from these events.
 */
export const ConversationDetailStore = signalStore(
  { providedIn: 'root' },

  withState({
    status: 'idle' as ConversationStatus,
    error: undefined as ChatAgentError | undefined,
    /** True when the user stopped the last reply before it was complete. */
    stopped: false,
    /** Sidebar title of the open thread; empty until the first message. */
    title: '',
    /** Epoch milliseconds of the first message; 0 while the thread is empty. */
    createdAt: 0,
    /** True while a stored thread is being read back from the service. */
    loading: false,
    /**
     * True while the service may still have a research completion to
     * announce in the open thread: from the start of every run, thread
     * switch and reopen until a research-updates call says nothing is left.
     */
    _researchPending: true,
    /** Threads opened in this session, by id; the open one is in the agent. */
    _threads: {} as Record<string, ChatThread>,
  }),

  withProps(() => ({
    _chatAgentClient: inject(ChatAgentClient),
    _threadClient: inject(ThreadClient),
    _session: inject(SESSION),
    _dispatch: injectDispatch(threadEvents),
  })),

  withComputed((store) => ({
    /** Id of the open thread, as the AG-UI agent holds it. */
    threadId: store._chatAgentClient.threadId,
    /** The whole thread, tool messages included; the tool renderers need them. */
    messages: store._chatAgentClient.messages,
    /** User turns, thinking summaries and assistant output in transcript order. */
    turns: computed(() =>
      normalizeThread(
        store._chatAgentClient.messages(),
        store._chatAgentClient.placements(),
      ).filter(isChatTurn),
    ),
    toolPresentation: computed(() =>
      toolPresentation(
        normalizeThread(
          store._chatAgentClient.messages(),
          store._chatAgentClient.placements(),
        ),
      ),
    ),
    toolActivities: computed(() =>
      toolActivities(
        store._chatAgentClient.messages(),
        store.status() === 'streaming',
      ),
    ),
    isStreaming: computed(() => store.status() === 'streaming'),
    isEmpty: computed(() => store._chatAgentClient.messages().length === 0),
  })),

  withMethods((store) => {
    let runGeneration = 0;
    let openGeneration = 0;
    let checkingResearch = false;
    async function refreshResearch(): Promise<void> {
      const scope = store._session.scope();
      if (
        checkingResearch ||
        !scope ||
        store.loading() ||
        store.isStreaming() ||
        !store._researchPending()
      )
        return;
      if (!hasResearchCall(store.messages())) {
        patchState(store, { _researchPending: false });
        return;
      }
      const id = store.threadId();
      const before = store.messages();
      checkingResearch = true;
      try {
        const updates = await firstValueFrom(
          store._threadClient.researchUpdates(id),
        );
        if (
          store._session.isCurrent(scope) &&
          store.threadId() === id &&
          !store.isStreaming() &&
          store.messages() === before
        ) {
          store._chatAgentClient.appendPersisted(updates.messages);
          patchState(store, { _researchPending: updates.pending });
        }
      } catch {
        /* A later refresh retries transient completion delivery failures. */
      } finally {
        checkingResearch = false;
      }
    }

    async function run(work: () => Promise<void>): Promise<void> {
      if (store.status() === 'streaming' || store.loading()) {
        return;
      }
      const scope = store._session.scope();
      if (!scope) return;
      const id = store.threadId();
      const generation = ++runGeneration;
      const current = () =>
        generation === runGeneration &&
        id === store.threadId() &&
        store._session.isCurrent(scope);
      patchState(store, {
        status: 'streaming',
        error: undefined,
        stopped: false,
        _researchPending: true,
      });
      try {
        await work();
      } catch (cause) {
        if (current() && store.status() !== 'error') {
          const error =
            cause instanceof Error ? cause : new Error(String(cause));
          patchState(store, {
            status: 'error',
            error: {
              code: CopilotKitCoreErrorCode.AGENT_RUN_FAILED,
              error,
              credits: creditsErrorOf(error.message),
            },
          });
        }
      } finally {
        if (current()) {
          if (store.status() === 'streaming') {
            patchState(store, { status: 'idle' });
          }
          store._dispatch.touched({ id, updatedAt: Date.now() });
        }
      }
    }

    /** Keeps the open conversation for a later `open`; nothing when it is empty. */
    function keep(): void {
      const messages = store.messages();
      if (!messages.length) return;
      const id = store.threadId();
      patchState(store, ({ _threads }) => ({
        _threads: {
          ..._threads,
          [id]: {
            id,
            title: store.title(),
            createdAt: store.createdAt(),
            updatedAt: Date.now(),
            messages,
          },
        },
      }));
    }

    /** Drops the open conversation without keeping it. */
    function discard(): void {
      runGeneration++;
      openGeneration++;
      store._chatAgentClient.stop();
      store._chatAgentClient.reset();
      patchState(store, {
        status: 'idle',
        error: undefined,
        stopped: false,
        title: '',
        createdAt: 0,
        loading: false,
        _researchPending: true,
      });
    }

    /** Replaces the open conversation with `thread`, keeping the one left behind. */
    function show(thread: ChatThread): void {
      runGeneration++;
      store._chatAgentClient.stop();
      keep();
      store._chatAgentClient.load(thread.id, thread.messages);
      patchState(store, {
        status: 'idle',
        error: undefined,
        stopped: false,
        title: thread.title,
        createdAt: thread.createdAt,
        loading: false,
        _researchPending: true,
      });
    }

    return {
      /**
       * Adds the user's turn and streams the assistant's reply. The turn is
       * in the history before the reply starts, so the sidebar shows the new
       * thread right away. `options` name the model and reasoning effort the
       * service should answer with; empty leaves the choice to the service.
       */
      send(content: string, options: ChatRunOptions = {}): Promise<void> {
        return run(async () => {
          if (store.isEmpty()) {
            const title = threadTitleOf(content);
            const createdAt = Date.now();
            patchState(store, { title, createdAt });
            store._dispatch.started({ id: store.threadId(), title, createdAt });
          }
          store._chatAgentClient.append(content);
          await store._chatAgentClient.send(options);
        });
      },

      /**
       * Replaces the last reply with a new one, or retries the last turn
       * after a failure. Ignored while the conversation is empty.
       */
      regenerate(options: ChatRunOptions = {}): Promise<void> {
        if (store.isEmpty()) {
          return Promise.resolve();
        }
        return run(() => store._chatAgentClient.regenerate(options));
      },

      /** Aborts the reply in flight and keeps whatever text arrived so far. */
      stop(): void {
        runGeneration++;
        store._chatAgentClient.stop();
        if (store.status() === 'streaming') {
          patchState(store, { status: 'idle', stopped: true });
        }
      },

      /** Shows a new sidebar title for the open thread; the service stores it. */
      rename(title: string): void {
        patchState(store, { title });
      },

      /**
       * Replaces the conversation with a stored thread: the one kept from
       * this session, or else the one the AI service returns. Returns false,
       * and changes nothing, when the service has no thread with that id for
       * this user.
       */
      async open(id: string): Promise<boolean> {
        const generation = ++openGeneration;
        const scope = store._session.scope();
        if (!scope) {
          return false;
        }
        if (id === store.threadId()) {
          patchState(store, { loading: false });
          return true;
        }
        const kept = store._threads()[id];
        if (kept) {
          show(kept);
          return true;
        }
        runGeneration++;
        store._chatAgentClient.stop();
        patchState(store, { loading: true, status: 'idle' });
        try {
          const thread = await firstValueFrom(store._threadClient.find(id));
          // A newer navigation owns the route. Treat the superseded request
          // as handled so its caller does not redirect the newer conversation.
          if (generation !== openGeneration) return true;
          if (!thread || !store._session.isCurrent(scope)) {
            return false;
          }
          show(thread);
          return true;
        } catch {
          return generation !== openGeneration;
        } finally {
          if (
            generation === openGeneration &&
            store._session.isCurrent(scope)
          ) {
            patchState(store, { loading: false });
          }
        }
      },

      /** Starts a new, empty conversation. The previous one stays in the history. */
      reset(): void {
        store._chatAgentClient.stop();
        keep();
        discard();
      },

      _discard: discard,
      _refreshResearch: refreshResearch,
    };
  }),

  withReducer(
    on(sessionEvents.invalidated, () => ({ _threads: {} })),
    on(threadEvents.renamed, ({ payload }) => ({ _threads }) => {
      const kept = _threads[payload.id];
      return kept
        ? { _threads: { ..._threads, [payload.id]: { ...kept, ...payload } } }
        : {};
    }),
    on(threadEvents.removed, ({ payload }) => ({ _threads }) => {
      const rest = { ..._threads };
      delete rest[payload];
      return { _threads: rest };
    }),
    on(threadEvents.cleared, () => ({ _threads: {} })),
  ),
  withEventHandlers((store, events = inject(Events)) => ({
    // The reducer above has already dropped the kept threads of that account.
    session: events.on(sessionEvents.invalidated).pipe(
      tap(() => store._discard()),
      ignoreElements(),
    ),
  })),
  withHooks({
    onInit(store) {
      // Asks the service for research completions while one may still be
      // due; the interval ends with the run, the thread or the last answer.
      effect((onCleanup) => {
        const scope = store._session.scope();
        store.threadId();
        if (
          !scope ||
          store.loading() ||
          store.isStreaming() ||
          !store._researchPending()
        )
          return;
        untracked(() => {
          void store._refreshResearch();
        });
        const timer = setInterval(() => {
          void store._refreshResearch();
        }, 8000);
        onCleanup(() => clearInterval(timer));
      });

      // Run failures do not reject `send()`; the client reports them here.
      const unsubscribe = store._chatAgentClient.onError((error) =>
        patchState(store, { status: 'error', error }),
      );
      inject(DestroyRef).onDestroy(unsubscribe);
    },
  }),

  withDevtools('conversationDetail'),
);
