import { inject, Injectable } from '@angular/core';

import { UserPreferencesCoordinator } from '../../user/api/preferences';
import type { ChatRunOptions } from '../data/chat-agent';
import { effectiveEffort, effectiveModel } from '../data/chat-model';
import { ConversationDetailStore } from './chat-page/conversation-detail-store';
import { ModelSearchStore } from './chat-page/model-search-store';
import { ThreadDetailStore } from './thread-search/thread-detail-store';
import { ThreadSearchStore } from './thread-search/thread-search-store';

/**
 * Combines the open conversation with the conversation history: every
 * change to the conversation is followed by a reload of the thread list,
 * and removing the open thread from the history starts a new conversation.
 * Each run carries the model and reasoning effort picked in the preferences,
 * as long as the AI service still offers them.
 * Navigation stays with the components; the coordinator reports whether the
 * open thread was affected so they can update the URL.
 */
@Injectable({ providedIn: 'root' })
export class ChatCoordinator {
  private readonly conversation = inject(ConversationDetailStore);
  private readonly threads = inject(ThreadSearchStore);
  private readonly threadDetail = inject(ThreadDetailStore);
  private readonly preferences = inject(UserPreferencesCoordinator);
  private readonly models = inject(ModelSearchStore);

  /** Id of the open thread; the sidebar highlights it. */
  readonly activeThreadId = this.conversation.threadId;

  /** Sends the prompt. The thread appears in the sidebar before the reply starts. */
  async send(prompt: string): Promise<void> {
    const sending = this.conversation.send(prompt, this.runOptions());
    this.threads.load();
    await sending;
    this.threads.load();
  }

  async regenerate(): Promise<void> {
    await this.conversation.regenerate(this.runOptions());
    this.threads.load();
  }

  stop(): void {
    this.conversation.stop();
    this.threads.load();
  }

  /** Opens a stored thread; false when the service has no thread with that id. */
  open(id: string): Promise<boolean> {
    if (this.conversation.threadId() === id) {
      return Promise.resolve(true);
    }
    return this.conversation.open(id);
  }

  startNew(): void {
    this.conversation.reset();
  }

  async rename(id: string, title: string): Promise<void> {
    const name = title.trim();
    if (!name) {
      return;
    }
    if (this.conversation.threadId() === id) {
      this.conversation.rename(name);
    }
    await this.threadDetail.rename({ id, title: name });
    this.threads.load();
  }

  /** Deletes a thread from the history. Returns true when it was the open one. */
  async remove(id: string): Promise<boolean> {
    const wasOpen = this.conversation.threadId() === id;
    if (wasOpen) {
      this.conversation.reset();
    }
    await this.threadDetail.remove(id);
    this.threads.load();
    return wasOpen;
  }

  /** Deletes the whole history and starts a new conversation. */
  async clear(): Promise<void> {
    this.conversation.reset();
    await this.threadDetail.clear();
    this.threads.load();
  }

  /** What to run with: each preference while the catalog lists it, else the service default. */
  private runOptions(): ChatRunOptions {
    const catalog = this.models.catalogValue();
    return {
      model: effectiveModel(this.preferences.model(), catalog),
      effort: effectiveEffort(this.preferences.effort(), catalog),
    };
  }
}
