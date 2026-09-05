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

import {
  ChatAgentError,
  isChatTurn,
  normalizeThread,
  toolActivities,
} from '../../data/chat-agent';
import { ChatAgentClient } from '../../data/chat-agent-client';
import { threadTitleOf } from '../../data/thread';
import { ThreadClient } from '../../data/thread-client';

export type ConversationStatus = 'idle' | 'streaming' | 'error';

/**
 * Detail store of the conversation shown on the chat page. The messages
 * themselves live in the AG-UI agent (the AI service is stateless and
 * receives the whole thread with every run); the store mirrors them as
 * signals and adds what the page needs on top: the run status, the last
 * error, whether the last reply was cut short and the turns worth showing.
 *
 * Every change is written to the conversation history (`ThreadClient`), so
 * the thread can be reopened from the sidebar. A run is a stream of AG-UI
 * events rather than a request/response pair, so it is driven by `send()`
 * instead of `withResource` / `withMutations`.
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
  }),

  withProps(() => ({
    _chatAgentClient: inject(ChatAgentClient),
    _threadClient: inject(ThreadClient),
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
    /** Writes the thread to the history; an empty thread is not worth keeping. */
    function persist(): void {
      const messages = store._chatAgentClient.snapshot();
      if (messages.length === 0) {
        return;
      }
      store._threadClient.save({
        id: store.threadId(),
        title: store.title(),
        createdAt: store.createdAt(),
        updatedAt: Date.now(),
        messages,
      });
    }

    async function run(work: () => Promise<void>): Promise<void> {
      if (store.status() === 'streaming') {
        return;
      }
      patchState(store, {
        status: 'streaming',
        error: undefined,
        stopped: false,
      });
      try {
        await work();
      } finally {
        if (store.status() === 'streaming') {
          patchState(store, { status: 'idle' });
        }
        persist();
      }
    }

    return {
      /**
       * Adds the user's turn and streams the assistant's reply. The turn is
       * in the history before the reply starts, so the sidebar shows the new
       * thread right away.
       */
      send(content: string): Promise<void> {
        return run(async () => {
          if (store.isEmpty()) {
            patchState(store, {
              title: threadTitleOf(content),
              createdAt: Date.now(),
            });
          }
          store._chatAgentClient.append(content);
          persist();
          await store._chatAgentClient.send();
        });
      },

      /**
       * Replaces the last reply with a new one, or retries the last turn
       * after a failure. Ignored while the conversation is empty.
       */
      regenerate(): Promise<void> {
        if (store.isEmpty()) {
          return Promise.resolve();
        }
        return run(() => store._chatAgentClient.regenerate());
      },

      /** Aborts the reply in flight and keeps whatever text arrived so far. */
      stop(): void {
        store._chatAgentClient.stop();
        if (store.status() === 'streaming') {
          patchState(store, { status: 'idle', stopped: true });
        }
        persist();
      },

      /** Gives the open thread a new sidebar title. */
      rename(title: string): void {
        patchState(store, { title });
        persist();
      },

      /**
       * Replaces the conversation with a stored thread. Returns false, and
       * changes nothing, when the history holds no thread with that id.
       */
      open(id: string): boolean {
        const thread = store._threadClient.find(id);
        if (!thread) {
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
        });
      },
    };
  }),

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
