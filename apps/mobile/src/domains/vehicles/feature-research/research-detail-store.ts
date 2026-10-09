import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useState } from 'react';

import { session, type SessionScope, useSession } from '../../auth/api/session';
import {
  cancelResearch,
  getResearch,
  replayResearch,
} from '../data/research-client';
import {
  researchIsActive,
  type ResearchSnapshot,
} from '../data/research-contracts';
import { researchCanReplay } from '../data/research-presentation';

export const RESEARCH_POLL_MS = 8000;

function researchKey(scope: SessionScope | null, id: string) {
  return [
    'vehicles',
    'research',
    scope?.uid ?? '',
    scope?.generation ?? 0,
    id,
  ] as const;
}

/** One private request, polled while the shared work is still running. */
export function researchQuery(scope: SessionScope | null, id: string) {
  return queryOptions({
    queryKey: researchKey(scope, id),
    queryFn: ({ signal }) => getResearch(id, signal),
    enabled: !!scope && !!id,
    staleTime: 0,
    retry: 1,
    refetchInterval: (query) =>
      researchIsActive(query.state.data) ? RESEARCH_POLL_MS : false,
  });
}

interface Target {
  id: string;
  scope: SessionScope;
}

/**
 * One private research request (web `ResearchDetailStore`): its snapshot,
 * polled every 8 s while it is queued or processing, independently of any
 * chat run; stopping to follow it; and a new interpretation of its saved
 * source, which the store then follows instead.
 */
export function useResearchDetailStore(
  requestId: string,
  onReplayed?: (id: string) => void,
) {
  const { scope } = useSession();
  const queryClient = useQueryClient();
  // The followed request: the requested one until a replay switches it.
  const [followed, setFollowed] = useState({
    requested: requestId,
    id: requestId,
  });
  let id = followed.id;
  if (followed.requested !== requestId) {
    setFollowed({ requested: requestId, id: requestId });
    id = requestId;
  }
  /** Idempotency key of a replay whose answer is still uncertain. */
  const [replayId, setReplayId] = useState('');

  const query = useQuery(researchQuery(scope, scope ? id : ''));
  const research: ResearchSnapshot | null =
    scope && query.data?.id === id ? query.data : null;

  const cancel = useMutation({
    mutationFn: ({ id: target, scope: owner }: Target) => {
      if (!session.isCurrent(owner))
        throw new Error('Sign in to manage this research request.');
      return cancelResearch(target);
    },
    onSuccess: async (snapshot, { id: target, scope: owner }) => {
      if (!session.isCurrent(owner) || snapshot.id !== target) return;
      // A confirmed detach wins over a late polling answer.
      const key = researchKey(owner, target);
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData(key, snapshot);
    },
  });

  const replay = useMutation({
    mutationFn: ({
      id: target,
      scope: owner,
      newRequestId,
    }: Target & { newRequestId: string }) => {
      if (!session.isCurrent(owner))
        throw new Error('Sign in to reinterpret this source.');
      return replayResearch(target, newRequestId);
    },
    onSuccess: (snapshot, { id: target, scope: owner }) => {
      if (!session.isCurrent(owner)) return;
      queryClient.setQueryData(researchKey(owner, snapshot.id), snapshot);
      setReplayId('');
      setFollowed((current) =>
        current.id === target ? { ...current, id: snapshot.id } : current,
      );
      onReplayed?.(snapshot.id);
    },
  });

  const cancelPending = cancel.isPending && cancel.variables?.id === id;
  const replayPending = replay.isPending && replay.variables?.id === id;

  return {
    id,
    signedIn: !!scope,
    research,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    loadFailed: query.isError,
    polling: researchIsActive(research),
    cancelPending,
    replayPending,
    cancellationError:
      cancel.isError && cancel.variables?.id === id
        ? 'Could not stop following. Try again.'
        : '',
    reinterpretationError:
      replay.isError && replay.variables?.id === id
        ? 'Could not reinterpret the saved source. Try again.'
        : '',
    reload(): void {
      if (scope && id && !query.isFetching) void query.refetch();
    },
    detach(): void {
      if (!scope || !id || cancel.isPending || replay.isPending) return;
      cancel.mutate({ id, scope });
    },
    reinterpret(): void {
      if (
        !scope ||
        !research ||
        !researchCanReplay(research) ||
        replay.isPending ||
        cancel.isPending
      )
        return;
      // An uncertain answer is retried with the same idempotency key.
      const newRequestId = replayId || randomUUID();
      setReplayId(newRequestId);
      replay.mutate({ id, scope, newRequestId });
    },
  };
}
