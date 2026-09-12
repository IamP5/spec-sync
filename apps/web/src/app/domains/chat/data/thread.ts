import type { Message } from '@ag-ui/client';
import { z } from 'zod';

/**
 * Chat history routes of the AI service, reached through the `/ai` proxy of
 * the web server. Part of the contract with `apps/ai` (`CHAT_THREADS_PATH` in
 * `src/mastra/threads/routes.ts`).
 */
export const CHAT_THREADS_URL = '/ai/chat/threads';

/** Longest title shown in the sidebar; longer ones are cut with an ellipsis. */
export const MAX_TITLE_LENGTH = 48;

/** Shown while a conversation has no title yet. */
const DEFAULT_TITLE = 'New chat';

/**
 * A conversation as the AI service stores it: the AG-UI thread id, the
 * messages Mastra memory holds (tool results included, so a reopened thread
 * can be continued) and what the sidebar shows about it.
 */
export interface ChatThread extends ChatThreadSummary {
  messages: Message[];
}

/** What the thread list needs; the messages are read when a thread is opened. */
export interface ChatThreadSummary {
  id: string;
  title: string;
  /** Epoch milliseconds. */
  createdAt: number;
  /** Epoch milliseconds of the last change. */
  updatedAt: number;
}

const threadSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const threadListSchema = z.object({ threads: z.array(threadSummarySchema) });

/** AG-UI messages are validated by the client that replays them, not here. */
const threadSchema = threadSummarySchema.extend({
  messages: z.array(z.unknown()),
});

export function parseThreadSummary(value: unknown): ChatThreadSummary {
  return titled(threadSummarySchema.parse(value));
}

export function parseThreadList(value: unknown): ChatThreadSummary[] {
  return threadListSchema.parse(value).threads.map(titled);
}

export function parseThread(value: unknown): ChatThread {
  const thread = threadSchema.parse(value);
  return {
    ...titled(thread),
    messages: thread.messages as Message[],
  };
}

/**
 * What the research-updates route of a thread answers: the completion
 * messages the AI service persisted for the research started from that
 * thread, and whether one of them is still running, so a later call may have
 * more to announce. A service that does not say is asked again.
 */
export interface ResearchUpdates {
  messages: Message[];
  pending: boolean;
}

const researchUpdatesSchema = z.object({
  messages: z.array(z.unknown()),
  pending: z.boolean().default(true),
});

export function parseResearchUpdates(value: unknown): ResearchUpdates {
  const updates = researchUpdatesSchema.parse(value);
  return { messages: updates.messages as Message[], pending: updates.pending };
}

/**
 * The AI service writes the title after the reply, so a thread can arrive
 * before it has one; the sidebar shows the same placeholder as a new chat.
 */
function titled<T extends ChatThreadSummary>(thread: T): T {
  return thread.title.trim() ? thread : { ...thread, title: DEFAULT_TITLE };
}

/** A section of the thread list, e.g. "Today". */
export interface ChatThreadGroup {
  label: string;
  threads: ChatThreadSummary[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Title derived from the user's first message: the first line, without
 * Markdown noise, cut to {@link MAX_TITLE_LENGTH}.
 */
export function threadTitleOf(text: string): string {
  const line =
    text
      .split('\n')
      .map((part) => part.replace(/^[#>*\-\s]+/, '').trim())
      .find(Boolean) ?? '';
  return line.length > MAX_TITLE_LENGTH
    ? `${line.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`
    : line || DEFAULT_TITLE;
}

/**
 * Splits threads into the date sections used by the sidebar, newest first
 * within each section. Sections without a thread are left out.
 */
export function groupThreads(
  threads: ChatThreadSummary[],
  now: number,
): ChatThreadGroup[] {
  const startOfToday = startOfDay(now);
  const sections: { label: string; from: number }[] = [
    { label: $localize`Today`, from: startOfToday },
    { label: $localize`Yesterday`, from: startOfToday - DAY_MS },
    { label: $localize`Previous 7 days`, from: startOfToday - 7 * DAY_MS },
    { label: $localize`Previous 30 days`, from: startOfToday - 30 * DAY_MS },
    { label: $localize`Older`, from: Number.NEGATIVE_INFINITY },
  ];
  const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
  return sections
    .map(({ label, from }, index) => {
      const to =
        index === 0 ? Number.POSITIVE_INFINITY : sections[index - 1].from;
      return {
        label,
        threads: sorted.filter((t) => t.updatedAt >= from && t.updatedAt < to),
      };
    })
    .filter((group) => group.threads.length > 0);
}

/** Case-insensitive title match; an empty query matches everything. */
export function matchesQuery(
  thread: ChatThreadSummary,
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase();
  return !needle || thread.title.toLocaleLowerCase().includes(needle);
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
