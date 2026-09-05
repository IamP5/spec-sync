import type { Message } from '@ag-ui/client';

/** Longest title shown in the sidebar; longer ones are cut with an ellipsis. */
export const MAX_TITLE_LENGTH = 48;

/**
 * A conversation as it is kept in the browser: the AG-UI thread id, the
 * messages the agent holds (tool results included, so a reopened thread can
 * be continued) and what the sidebar shows about it.
 */
export interface ChatThread extends ChatThreadSummary {
  messages: Message[];
}

/** What the thread list needs; the messages stay in storage until a thread is opened. */
export interface ChatThreadSummary {
  id: string;
  title: string;
  /** Epoch milliseconds. */
  createdAt: number;
  /** Epoch milliseconds of the last change. */
  updatedAt: number;
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
    : line || 'New chat';
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
    { label: 'Today', from: startOfToday },
    { label: 'Yesterday', from: startOfToday - DAY_MS },
    { label: 'Previous 7 days', from: startOfToday - 7 * DAY_MS },
    { label: 'Previous 30 days', from: startOfToday - 30 * DAY_MS },
    { label: 'Older', from: Number.NEGATIVE_INFINITY },
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
