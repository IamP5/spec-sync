import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { session, type SessionScope, useSession } from '../../auth/api/session';
import {
  getResearchPeople,
  saveResearchInterest,
} from '../data/research-client';
import type {
  ResearchInterestInput,
  ResearchPeople,
} from '../data/research-contracts';

function peopleKey(scope: SessionScope | null, id: string) {
  return [
    'vehicles',
    'research-interests',
    scope?.uid ?? '',
    scope?.generation ?? 0,
    id,
  ] as const;
}

export function researchPeopleQuery(scope: SessionScope | null, id: string) {
  return queryOptions({
    queryKey: peopleKey(scope, id),
    queryFn: ({ signal }) => getResearchPeople(id, signal),
    enabled: !!scope && !!id,
    staleTime: 0,
    retry: false,
  });
}

/**
 * The people who chose to share a profile on one research, and the reader's
 * own profile there (web `ResearchInterestSearchStore` and
 * `ResearchInterestDetailStore`). `id` is empty while the people sheet is
 * closed, so nothing loads until the reader opens it.
 */
export function useResearchInterestDetailStore(id: string) {
  const { scope } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery(researchPeopleQuery(scope, scope ? id : ''));
  const save = useMutation({
    mutationFn: ({
      id: target,
      scope: owner,
      input,
    }: {
      id: string;
      scope: SessionScope;
      input: ResearchInterestInput;
    }) => {
      if (!session.isCurrent(owner))
        throw new Error('Sign in to share your profile');
      return saveResearchInterest(target, input);
    },
    onSuccess: (page: ResearchPeople, { id: target, scope: owner }) => {
      if (session.isCurrent(owner))
        queryClient.setQueryData(peopleKey(owner, target), page);
    },
  });
  const current = save.variables?.id === id && !!id;
  return {
    page: scope && id ? (query.data ?? null) : null,
    isLoading: query.isLoading,
    loadFailed: query.isError,
    savePending: save.isPending && current,
    saved: save.isSuccess && current,
    error: save.isError && current ? 'Could not save. Please try again.' : '',
    reload(): void {
      if (id && !query.isFetching) void query.refetch();
    },
    submit(input: ResearchInterestInput): void {
      if (!scope || !id || save.isPending) return;
      save.mutate({ id, scope, input });
    },
  };
}
