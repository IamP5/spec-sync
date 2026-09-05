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
 * error and the turns worth showing.
 *
 * A run is a stream of AG-UI events rather than a request/response pair, so
 * it is driven by `send()` instead of `withResource` / `withMutations`.
 */
export const ConversationDetailStore = signalStore(
  { providedIn: 'root' },

  withState({
    status: 'idle' as ConversationStatus,
    error: undefined as ChatAgentError | undefined,
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

  withMethods((store) => ({
    /** Adds the user's turn and streams the assistant's reply. */
    async send(content: string): Promise<void> {
      if (store.status() === 'streaming') {
        return;
      }
      patchState(store, { status: 'streaming', error: undefined });
      try {
        await store._chatAgentClient.send(content);
      } finally {
        if (store.status() === 'streaming') {
          patchState(store, { status: 'idle' });
        }
      }
    },

    /** Aborts the reply in flight and keeps whatever text arrived so far. */
    stop(): void {
      store._chatAgentClient.stop();
      if (store.status() === 'streaming') {
        patchState(store, { status: 'idle' });
      }
    },

    /** Starts a new conversation. */
    reset(): void {
      store._chatAgentClient.stop();
      store._chatAgentClient.reset();
      patchState(store, { status: 'idle', error: undefined });
    },
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
