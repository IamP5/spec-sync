import { Injectable } from '@angular/core';

import { ChatThread, ChatThreadSummary } from './thread';

/** Storage key; bump the version when the stored shape changes. */
const STORAGE_KEY = 'specsync.chat.threads.v1';
/** Threads kept in storage; the oldest are dropped beyond this. */
const MAX_THREADS = 200;

/**
 * Data access for the conversation history. The AI service is stateless
 * (it receives the whole thread with every run), so the threads live in the
 * browser's local storage. The client is stateless itself: every call reads
 * or writes storage, and the stores mirror the result as signals.
 *
 * Storage may be unavailable (private mode, quota, disabled); every access is
 * guarded and a failed write is reported through the boolean result.
 */
@Injectable({ providedIn: 'root' })
export class ThreadClient {
  /** Every stored thread without its messages, in storage order. */
  list(): ChatThreadSummary[] {
    return this.read().map(({ id, title, createdAt, updatedAt }) => ({
      id,
      title,
      createdAt,
      updatedAt,
    }));
  }

  find(id: string): ChatThread | undefined {
    return this.read().find((thread) => thread.id === id);
  }

  /** Inserts or replaces the thread. */
  save(thread: ChatThread): boolean {
    const others = this.read().filter((t) => t.id !== thread.id);
    return this.write([...others, thread].slice(-MAX_THREADS));
  }

  rename(id: string, title: string): boolean {
    return this.write(
      this.read().map((thread) =>
        thread.id === id ? { ...thread, title } : thread,
      ),
    );
  }

  remove(id: string): boolean {
    return this.write(this.read().filter((thread) => thread.id !== id));
  }

  clear(): boolean {
    return this.write([]);
  }

  private read(): ChatThread[] {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(isThread) : [];
    } catch {
      return [];
    }
  }

  private write(threads: ChatThread[]): boolean {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(threads));
      return true;
    } catch {
      return false;
    }
  }
}

function isThread(value: unknown): value is ChatThread {
  const thread = value as Partial<ChatThread> | null;
  return (
    typeof thread?.id === 'string' &&
    typeof thread.title === 'string' &&
    typeof thread.createdAt === 'number' &&
    typeof thread.updatedAt === 'number' &&
    Array.isArray(thread.messages)
  );
}
