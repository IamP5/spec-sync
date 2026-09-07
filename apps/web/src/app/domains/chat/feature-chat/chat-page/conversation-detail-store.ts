import { computed, DestroyRef, inject } from '@angular/core';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { Events, withEventHandlers } from '@ngrx/signals/events';
import { firstValueFrom, ignoreElements, tap } from 'rxjs';

import { sessionEvents } from '../../../auth/api/events';
import { SESSION } from '../../../auth/api/session';
import {
  ChatAgentError,
  type ChatRunOptions,
  isChatTurn,
  normalizeThread,
  toolActivities,
} from '../../data/chat-agent';
import { ChatAgentClient } from '../../data/chat-agent-client';
import { threadTitleOf } from '../../data/thread';
import { ThreadClient } from '../../data/thread-client';

export type ConversationStatus = 'idle' | 'streaming' | 'error';

/**
 * Detail store of the conversation shown on the chat page. The AI service
 * persists every turn in Mastra memory as the run happens, so nothing here
 * writes the history; the AG-UI agent holds the messages for display and the
 * store mirrors them as signals, adding what the page needs on top: the run
 * status, the last error, whether the last reply was cut short and the turns
 * worth showing.
 *
 * Reopening a thread reads it back from the service (`ThreadClient`). A run
 * is a stream of AG-UI events rather than a request/response pair, so it is
 * driven by `send()` instead of `withResource` / `withMutations`.
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
  }),

  withProps(() => ({
    _chatAgentClient: inject(ChatAgentClient),
    _threadClient: inject(ThreadClient),
    _session: inject(SESSION),
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
    async function run(work: () => Promise<void>): Promise<void> {
      if (store.status() === 'streaming') {
        return;
      }
      const scope = store._session.scope();
      if (!scope) return;
      patchState(store, {
        status: 'streaming',
        error: undefined,
        stopped: false,
      });
      try {
        await work();
      } finally {
        if (store._session.isCurrent(scope) && store.status() === 'streaming') {
          patchState(store, { status: 'idle' });
        }
      }
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
            patchState(store, {
              title: threadTitleOf(content),
              createdAt: Date.now(),
            });
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
       * Replaces the conversation with a stored thread read back from the AI
       * service. Returns false, and changes nothing, when the service has no
       * thread with that id for this user.
       */
      async open(id: string): Promise<boolean> {
        const scope = store._session.scope();
        if (!scope) {
          return false;
        }
        patchState(store, { loading: true });
        try {
          const thread = await firstValueFrom(store._threadClient.find(id));
          if (!thread || !store._session.isCurrent(scope)) {
            return false;
          }
          store._chatAgentClient.stop();
          store._chatAgentClient.load(thread.id, thread.messages);
          patchState(store, {
            status: 'idle',
            error: undefined,
            stopped: false,
            title: thread.title,
            createdAt: thread.createdAt,
          });
          return true;
        } catch {
          return false;
        } finally {
          if (store._session.isCurrent(scope)) {
            patchState(store, { loading: false });
          }
        }
      },

      /** Starts a new, empty conversation. The previous one stays in the history. */
      reset(): void {
        store._chatAgentClient.stop();
        store._chatAgentClient.reset();
        patchState(store, {
          status: 'idle',
          error: undefined,
          stopped: false,
          title: '',
          createdAt: 0,
          loading: false,
        });
      },
    };
  }),

  withEventHandlers((store, events = inject(Events)) => ({
    session: events.on(sessionEvents.invalidated).pipe(
      tap(() => store.reset()),
      ignoreElements(),
    ),
  })),
  withHooks({
    onInit(store) {
      // Run failures do not reject `send()`; the client reports them here.
      const unsubscribe = store._chatAgentClient.onError((error) =>
        patchState(store, { status: 'error', error }),
      );
      inject(DestroyRef).onDestroy(unsubscribe);
    },
  }),

  withDevtools('conversationDetail'),
);
