import { Injectable, resource, signal } from '@angular/core';
import { Observable, of } from 'rxjs';

import {
  ChatThread,
  ChatThreadSummary,
  ResearchUpdates,
} from '../domains/chat/data/thread';
import { ThreadClient } from '../domains/chat/data/thread-client';

/**
 * In-memory stand-in for the chat history the AI service owns. It answers the
 * same calls as `ThreadClient` without HTTP, so store and component tests can
 * seed threads and assert what the sidebar does with them.
 */
@Injectable()
export class FakeThreadClient {
  private readonly threads = signal<ChatThread[]>([]);

  seed(...threads: ChatThread[]): void {
    this.threads.update((current) => [...current, ...threads]);
  }

  /** What the service would have stored after a run. */
  record(thread: ChatThread): void {
    this.threads.update((current) => [
      ...current.filter((candidate) => candidate.id !== thread.id),
      thread,
    ]);
  }

  all(): ChatThread[] {
    return this.threads();
  }

  listResource() {
    return resource({
      params: () => this.threads(),
      loader: ({ params }) => Promise.resolve(params.map(summaryOf)),
      defaultValue: [] as ChatThreadSummary[],
    });
  }

  find(id: string): Observable<ChatThread | undefined> {
    return of(this.threads().find((thread) => thread.id === id));
  }

  /** Nothing to announce and nothing running: the store stops asking. */
  researchUpdates(): Observable<ResearchUpdates> {
    return of({ messages: [], pending: false });
  }

  rename(id: string, title: string): Observable<ChatThreadSummary> {
    this.threads.update((current) =>
      current.map((thread) =>
        thread.id === id ? { ...thread, title } : thread,
      ),
    );
    const renamed = this.threads().find((thread) => thread.id === id);
    return of(summaryOf(renamed ?? blank(id, title)));
  }

  remove(id: string): Observable<void> {
    this.threads.update((current) =>
      current.filter((thread) => thread.id !== id),
    );
    return of(undefined);
  }

  clear(): Observable<void> {
    this.threads.set([]);
    return of(undefined);
  }
}

export function provideFakeThreads() {
  return [
    FakeThreadClient,
    { provide: ThreadClient, useExisting: FakeThreadClient },
  ];
}

/** A stored thread with the shape the AI service returns. */
export function storedThread(
  id: string,
  title: string,
  updatedAt = 1,
  messages: ChatThread['messages'] = [],
): ChatThread {
  return { id, title, createdAt: 1, updatedAt, messages };
}

function summaryOf(thread: ChatThread): ChatThreadSummary {
  const { id, title, createdAt, updatedAt } = thread;
  return { id, title, createdAt, updatedAt };
}

function blank(id: string, title: string): ChatThread {
  return storedThread(id, title);
}
