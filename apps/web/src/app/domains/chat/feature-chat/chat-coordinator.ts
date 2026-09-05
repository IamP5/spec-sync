import { inject, Injectable } from '@angular/core';

import { ConversationDetailStore } from './chat-page/conversation-detail-store';
import { ThreadSearchStore } from './thread-search/thread-search-store';

/**
 * Combines the open conversation with the conversation history: every
 * change to the conversation is followed by a reload of the thread list,
 * and removing the open thread from the history starts a new conversation.
 * Navigation stays with the components; the coordinator reports whether the
 * open thread was affected so they can update the URL.
 */
@Injectable({ providedIn: 'root' })
export class ChatCoordinator {
  private readonly conversation = inject(ConversationDetailStore);
  private readonly threads = inject(ThreadSearchStore);

  /** Id of the open thread; the sidebar highlights it. */
  readonly activeThreadId = this.conversation.threadId;

  /** Sends the prompt. The thread appears in the sidebar before the reply starts. */
  async send(prompt: string): Promise<void> {
    const sending = this.conversation.send(prompt);
    this.threads.load();
    await sending;
    this.threads.load();
  }

  async regenerate(): Promise<void> {
    await this.conversation.regenerate();
    this.threads.load();
  }

  stop(): void {
    this.conversation.stop();
    this.threads.load();
  }

  /** Opens a stored thread; false when the history has no thread with that id. */
  open(id: string): boolean {
    if (this.conversation.threadId() === id) {
      return true;
    }
    return this.conversation.open(id);
  }

  startNew(): void {
    this.conversation.reset();
  }

  rename(id: string, title: string): void {
    const name = title.trim();
    if (!name) {
      return;
    }
    this.threads.rename(id, name);
    if (this.conversation.threadId() === id) {
      this.conversation.rename(name);
    }
  }

  /** Deletes a thread from the history. Returns true when it was the open one. */
  remove(id: string): boolean {
    this.threads.remove(id);
    const wasOpen = this.conversation.threadId() === id;
    if (wasOpen) {
      this.conversation.reset();
    }
    return wasOpen;
  }

  /** Deletes the whole history and starts a new conversation. */
  clear(): void {
    this.threads.clear();
    this.conversation.reset();
  }
}
