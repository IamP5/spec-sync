import { inject, Injectable } from '@angular/core';

import { UserPreferencesCoordinator } from '../../user/api/preferences';
import type { ChatRunOptions } from '../data/chat-agent';
import { effectiveEffort, effectiveMode } from '../data/chat-model';
import { ConversationDetailStore } from './chat-page/conversation-detail-store';
import { CreditsDetailStore } from './chat-page/credits-detail-store';
import { ModelSearchStore } from './chat-page/model-search-store';
import { ThreadDetailStore } from './thread-search/thread-detail-store';
import { ThreadSearchStore } from './thread-search/thread-search-store';

/**
 * Combines the open conversation with the conversation history. The thread
 * list keeps itself in step with the conversation and the history writes
 * (`threadEvents`); the coordinator reads it again only once per new
 * conversation, after the first reply, for the title the AI service
 * generates. Removing the open thread from the history starts a new
 * conversation.
 * Each run carries the mode and the reasoning effort picked in the
 * preferences, as long as the AI service still offers them.
 * Navigation stays with the components; the coordinator reports whether the
 * open thread was affected so they can update the URL.
 * A run is what spends AI credits, so the wallet is read again whenever a run
 * ends, however it ended: completed, stopped, failed or refused before the
 * first model call.
 */
@Injectable({ providedIn: 'root' })
export class ChatCoordinator {
  private readonly conversation = inject(ConversationDetailStore);
  private readonly threads = inject(ThreadSearchStore);
  private readonly threadDetail = inject(ThreadDetailStore);
  private readonly preferences = inject(UserPreferencesCoordinator);
  private readonly models = inject(ModelSearchStore);
  private readonly credits = inject(CreditsDetailStore);

  /** Id of the open thread; the sidebar highlights it. */
  readonly activeThreadId = this.conversation.threadId;

  /**
   * The credits wallet, as the chat page needs it. Reading it stays with the
   * store; the coordinator only forwards it, so the page keeps one source for
   * everything a run depends on.
   */
  readonly creditsEnabled = this.credits.enabled;
  readonly creditsBalance = this.credits.balance;
  readonly creditsGranted = this.credits.granted;
  readonly creditsSpent = this.credits.spent;
  readonly creditsAvailable = this.credits.available;
  readonly creditsExhausted = this.credits.exhausted;
  readonly creditsRecentRuns = this.credits.recentRuns;

  /** Reads the wallet again, e.g. when the user asks to try a rejected run. */
  reloadCredits(): void {
    this.credits.reload();
  }

  /**
   * Sends the prompt. The thread appears in the sidebar before the reply
   * starts; after the first reply the list is read again for the title the
   * service generated for it.
   */
  async send(prompt: string): Promise<void> {
    const first = this.conversation.isEmpty();
    try {
      await this.conversation.send(prompt, this.runOptions());
    } finally {
      this.afterRun();
    }
    if (first) {
      this.threads.load();
    }
  }

  async regenerate(): Promise<void> {
    try {
      await this.conversation.regenerate(this.runOptions());
    } finally {
      this.afterRun();
    }
  }

  stop(): void {
    this.conversation.stop();
  }

  /** Opens a stored thread; false when the service has no thread with that id. */
  open(id: string): Promise<boolean> {
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
  }

  /** Deletes a thread from the history. Returns true when it was the open one. */
  async remove(id: string): Promise<boolean> {
    const wasOpen = this.conversation.threadId() === id;
    if (wasOpen) {
      this.conversation.reset();
    }
    await this.threadDetail.remove(id);
    return wasOpen;
  }

  /** Deletes the whole history and starts a new conversation. */
  async clear(): Promise<void> {
    this.conversation.reset();
    await this.threadDetail.clear();
  }

  /** What a finished run leaves to read again: the wallet, which it spent. */
  private afterRun(): void {
    this.credits.reload();
  }

  /** What to run with: each preference while the catalog lists it, else the service default. */
  private runOptions(): ChatRunOptions {
    const catalog = this.models.catalogValue();
    return {
      mode: effectiveMode(this.preferences.mode(), catalog),
      effort: effectiveEffort(this.preferences.effort(), catalog),
    };
  }
}
