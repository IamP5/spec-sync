import { queryOptions, useQuery } from '@tanstack/react-query';

import { useSession } from '../../auth/api/session';
import { walletOf } from '../data/credits';
import { fetchCredits } from '../data/credits-client';

function creditsQuery(uid: string, generation: number) {
  return queryOptions({
    queryKey: ['chat', 'credits', uid, generation],
    queryFn: ({ signal }) => fetchCredits(signal),
  });
}

/**
 * The AI credits wallet (web `CreditsDetailStore`); read again after every
 * run. `wallet` is undefined while credits are off or unreadable.
 */
export function useCreditsStore() {
  const scope = useSession().scope;
  const query = useQuery({
    ...creditsQuery(scope?.uid ?? '', scope?.generation ?? 0),
    enabled: scope !== null,
  });
  return {
    wallet: walletOf(query.data),
    refresh: () => void query.refetch(),
  };
}
