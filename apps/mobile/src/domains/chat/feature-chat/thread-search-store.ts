import { queryOptions, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useSession } from '../../auth/api/session';
import { groupThreads, matchesQuery } from '../data/thread';
import { listThreads } from '../data/thread-client';

function threadsQuery(uid: string, generation: number) {
  return queryOptions({
    queryKey: ['chat', 'threads', uid, generation],
    queryFn: ({ signal }) => listThreads(signal),
    staleTime: 30 * 1000,
  });
}

/**
 * The user's conversations for the chat list (web `ThreadSearchStore`):
 * grouped by date and filtered by title on the device.
 */
export function useThreadSearchStore() {
  const scope = useSession().scope;
  const [query, setQuery] = useState('');
  const threads = useQuery({
    ...threadsQuery(scope?.uid ?? '', scope?.generation ?? 0),
    enabled: scope !== null,
  });
  const all = threads.data ?? [];
  const now = threads.dataUpdatedAt || Date.now();
  return {
    query,
    setQuery,
    loading: scope !== null && threads.isLoading,
    refreshing: threads.isRefetching,
    failed: threads.isError,
    threads: all,
    groups: groupThreads(
      all.filter((thread) => matchesQuery(thread, query)),
      now,
    ),
    titleOf: (id: string) => all.find((thread) => thread.id === id)?.title,
    refresh: () => void threads.refetch(),
  };
}
