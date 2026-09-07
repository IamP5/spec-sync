import { type } from '@ngrx/signals';
import { eventGroup } from '@ngrx/signals/events';

import type { ChatThreadSummary } from './thread';

/**
 * What the browser knows about the conversation history without asking the
 * AI service again. The conversation store announces the threads it starts
 * and continues, the thread detail store the writes the service confirmed;
 * the thread search store keeps its cached list in step with them, so the
 * list is read once per session instead of after every change.
 *
 * The one thing only the service knows is the title it generates after the
 * first reply; the chat coordinator reads the list again once for that.
 */
export const threadEvents = eventGroup({
  source: 'Chat Threads',
  events: {
    /** A new conversation got its first message. */
    started: type<Pick<ChatThreadSummary, 'id' | 'title' | 'createdAt'>>(),
    /** A run on an existing conversation ended, so it is the most recent one. */
    touched: type<Pick<ChatThreadSummary, 'id' | 'updatedAt'>>(),
    /** The service stored a new title; the payload is what it returned. */
    renamed: type<ChatThreadSummary>(),
    /** The service deleted the thread with this id. */
    removed: type<string>(),
    /** The service deleted the whole history. */
    cleared: type<void>(),
  },
});
