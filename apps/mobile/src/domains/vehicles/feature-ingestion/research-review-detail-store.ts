import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { session, type SessionScope, useSession } from '../../auth/api/session';
import {
  getResearchReview,
  publishResearchReview,
} from '../data/ingestion-client';
import type {
  IngestionReview,
  IngestionRun,
} from '../data/ingestion-contracts';

function reviewKey(scope: SessionScope | null, researchId: string) {
  return [
    'vehicles',
    'research-review',
    scope?.uid ?? '',
    scope?.generation ?? 0,
    researchId,
  ] as const;
}

export function researchReviewQuery(
  scope: SessionScope | null,
  researchId: string,
) {
  return queryOptions({
    queryKey: reviewKey(scope, researchId),
    queryFn: ({ signal }) => getResearchReview(researchId, signal),
    enabled: !!scope && !!researchId,
    staleTime: 0,
    retry: 1,
  });
}

/**
 * The review run behind one research request and the publication of the
 * reviewer's selection (the research mode of the web `IngestionDetailStore`).
 * The reader's account authorizes both.
 */
export function useResearchReviewDetailStore(researchId: string) {
  const { scope } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery(researchReviewQuery(scope, scope ? researchId : ''));
  const publish = useMutation({
    mutationFn: ({
      researchId: target,
      scope: owner,
      review,
    }: {
      researchId: string;
      scope: SessionScope;
      review: IngestionReview;
    }) => {
      if (!session.isCurrent(owner))
        throw new Error('Sign in to publish this review.');
      return publishResearchReview(target, review);
    },
    onSuccess: (run, { researchId: target, scope: owner }) => {
      if (!session.isCurrent(owner)) return;
      const key = reviewKey(owner, target);
      queryClient.setQueryData(key, run);
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const current = publish.variables?.researchId === researchId;
  return {
    run: scope ? query.data : undefined,
    isLoading: query.isLoading,
    loadFailed: query.isError,
    publishPending: publish.isPending && current,
    publishError: publish.isError && current ? publish.error.message : '',
    reload(): void {
      if (researchId && !query.isFetching) void query.refetch();
    },
    /** Resolves with the persisted run, or null when the publication failed. */
    async publish(review: IngestionReview): Promise<IngestionRun | null> {
      if (!scope || !researchId || publish.isPending) return null;
      try {
        return await publish.mutateAsync({ researchId, scope, review });
      } catch {
        return null;
      }
    },
  };
}
