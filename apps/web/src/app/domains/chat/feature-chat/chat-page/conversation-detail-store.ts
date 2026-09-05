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
} from '../../data/chat-agent';
import { ChatAgentClient } from '../../data/chat-agent-client';

export type ConversationStatus = 'idle' | 'streaming' | 'error';

/**
 * Detail store of the single conversation shown on the chat page. The
 * messages themselves live in the AG-UI agent (the AI service is stateless
 * and receives the whole thread with every run); the store mirrors them as
 * signals and adds what the page needs on top: the run status, the last
 * error, whether the last reply was cut short and the turns worth showing.
 *
 * A run is a stream of AG-UI events rather than a request/response pair, so
 * it is driven by `send()` instead of `withResource` / `withMutations`.
 */
export const ConversationDetailStore = signalStore(
  { providedIn: 'root' },

  withState({
    status: 'idle' as ConversationStatus,
    error: undefined as ChatAgentError | undefined,
    /** True when the user stopped the last reply before it was complete. */
    stopped: false,
  }),

  withProps(() => ({
    _chatAgentClient: inject(ChatAgentClient),
  })),

  withComputed((store) => ({
    /** The whole thread, tool messages included; the tool renderers need them. */
    messages: store._chatAgentClient.messages,
    /** User and assistant turns only, in the order things happened. */
    turns: computed(() =>
      normalizeThread(
        store._chatAgentClient.messages(),
        store._chatAgentClient.placements(),
      ).filter(isChatTurn),
    ),
    isStreaming: computed(() => store.status() === 'streaming'),
    isEmpty: computed(() => store._chatAgentClient.messages().length === 0),
  })),

  withMethods((store) => {
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
      }
    }

    return {
      /** Adds the user's turn and streams the assistant's reply. */
      send(content: string): Promise<void> {
        return run(() => store._chatAgentClient.send(content));
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
      },

      /** Starts a new conversation. */
      reset(): void {
        store._chatAgentClient.stop();
        store._chatAgentClient.reset();
        patchState(store, { status: 'idle', error: undefined, stopped: false });
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
