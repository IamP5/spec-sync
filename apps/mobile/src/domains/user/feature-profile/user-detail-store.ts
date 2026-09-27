import { queryOptions, useQuery } from '@tanstack/react-query';

import { useSession } from '../../auth/api/session';
import { fetchUserProfile } from '../data/user-profile-client';

function profileQuery(uid: string, generation: number) {
  return queryOptions({
    queryKey: ['user', 'profile', uid, generation],
    queryFn: ({ signal }) => fetchUserProfile(signal),
  });
}

/** The signed-in user's Google profile (web `UserDetailStore`). */
export function useUserDetailStore() {
  const scope = useSession().scope;
  const query = useQuery({
    ...profileQuery(scope?.uid ?? '', scope?.generation ?? 0),
    enabled: scope !== null,
  });
  return {
    user: query.data,
    loading: scope !== null && query.isLoading,
    failed: query.isError,
  };
}
