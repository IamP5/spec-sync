import { queryOptions, useQuery } from '@tanstack/react-query';

import { useSession } from '../../auth/api/session';
import { fetchChatModels } from '../data/chat-model-client';

function modelsQuery(uid: string) {
  return queryOptions({
    queryKey: ['chat', 'models', uid],
    queryFn: ({ signal }) => fetchChatModels(signal),
    staleTime: 10 * 60 * 1000,
  });
}

/** The modes the AI service offers (web `ModelSearchStore`). */
export function useChatModelStore() {
  const scope = useSession().scope;
  const query = useQuery({
    ...modelsQuery(scope?.uid ?? ''),
    enabled: scope !== null,
  });
  return { catalog: query.data };
}
