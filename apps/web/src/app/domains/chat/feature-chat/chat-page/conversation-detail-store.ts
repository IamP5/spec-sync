import { computed, inject } from '@angular/core';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { Subscription } from 'rxjs';

import { ChatClient } from '../../data/chat-client';
import { ChatMessage } from '../../data/chat-message';

export type ConversationStatus = 'idle' | 'streaming' | 'error';

/**
 * Detail store of the single conversation shown on the chat page. The AI
 * service is stateless, so the whole transcript lives here and is sent in
 * full with every turn.
 *
 * The reply is a stream rather than a request/response pair, so it is driven
 * by a subscription instead of `withResource` / `withMutations`: every text
 * delta is appended to the pending assistant message as it arrives.
 */
export const ConversationDetailStore = signalStore(
  { providedIn: 'root' },

  withState({
    messages: [] as ChatMessage[],
    status: 'idle' as ConversationStatus,
    error: undefined as unknown,
  }),

  withProps(() => ({
    _chatClient: inject(ChatClient),
    _reply: undefined as Subscription | undefined,
  })),

  withComputed((store) => ({
    isStreaming: computed(() => store.status() === 'streaming'),
    isEmpty: computed(() => store.messages().length === 0),
  })),

  withMethods((store) => {
    const appendDelta = (delta: string) =>
      patchState(store, {
        messages: appendToLastMessage(store.messages(), delta),
      });

    return {
      /** Adds the user's turn and streams the assistant's reply into a new message. */
      send(content: string): void {
        if (store.status() === 'streaming') {
          return;
        }
        const history = [
          ...store.messages(),
          { role: 'user', content } satisfies ChatMessage,
        ];
        patchState(store, {
          messages: [...history, { role: 'assistant', content: '' }],
          status: 'streaming',
          error: undefined,
        });

        store._reply = store._chatClient.streamReply(history).subscribe({
          next: appendDelta,
          error: (error: unknown) =>
            patchState(store, {
              status: 'error',
              error,
              messages: dropEmptyReply(store.messages()),
            }),
          complete: () => patchState(store, { status: 'idle' }),
        });
      },

      /** Aborts the reply in flight and keeps whatever text arrived so far. */
      stop(): void {
        store._reply?.unsubscribe();
        store._reply = undefined;
        if (store.status() === 'streaming') {
          patchState(store, {
            status: 'idle',
            messages: dropEmptyReply(store.messages()),
          });
        }
      },

      /** Starts a new conversation. */
      reset(): void {
        this.stop();
        patchState(store, { messages: [], status: 'idle', error: undefined });
      },
    };
  }),

  withDevtools('conversationDetail'),
);

function appendToLastMessage(
  messages: ChatMessage[],
  delta: string,
): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (!last) {
    return messages;
  }
  return [...messages.slice(0, -1), { ...last, content: last.content + delta }];
}

/** Removes a trailing assistant message that never received any text. */
function dropEmptyReply(messages: ChatMessage[]): ChatMessage[] {
  const last = messages[messages.length - 1];
  return last?.role === 'assistant' && last.content === ''
    ? messages.slice(0, -1)
    : messages;
}
