import {
  gatewayErrorOf,
  gatewayFetch,
  gatewayJson,
  gatewaySend,
} from '../../auth/api/session';
import {
  CHAT_THREADS_URL,
  type ChatThread,
  type ChatThreadSummary,
  parseResearchUpdates,
  parseThread,
  parseThreadList,
  parseThreadSummary,
  type ResearchUpdates,
} from './thread';

function threadPath(id: string): string {
  return `${CHAT_THREADS_URL}/${encodeURIComponent(id)}`;
}

/** The user's conversations, most recently changed first. */
export function listThreads(
  signal?: AbortSignal,
): Promise<ChatThreadSummary[]> {
  return gatewayJson(CHAT_THREADS_URL, parseThreadList, { signal });
}

/** One conversation with its AG-UI messages; `undefined` when it is gone. */
export async function findThread(
  id: string,
  signal?: AbortSignal,
): Promise<ChatThread | undefined> {
  const response = await gatewayFetch(threadPath(id), { signal });
  if (response.status === 404) return undefined;
  if (!response.ok) throw await gatewayErrorOf(response);
  return parseThread(await response.json());
}

export function renameThread(
  id: string,
  title: string,
): Promise<ChatThreadSummary> {
  return gatewayJson(threadPath(id), parseThreadSummary, {
    method: 'PATCH',
    body: { title },
  });
}

export function removeThread(id: string): Promise<void> {
  return gatewaySend(threadPath(id), { method: 'DELETE' });
}

export function clearThreads(): Promise<void> {
  return gatewaySend(CHAT_THREADS_URL, { method: 'DELETE' });
}

/** Completion messages of research started from the thread, and whether more may come. */
export function fetchResearchUpdates(
  id: string,
  signal?: AbortSignal,
): Promise<ResearchUpdates> {
  return gatewayJson(
    `${threadPath(id)}/research-updates`,
    parseResearchUpdates,
    {
      method: 'POST',
      body: {},
      signal,
    },
  );
}
