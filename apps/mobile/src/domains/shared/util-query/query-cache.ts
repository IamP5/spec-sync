import { QueryClient } from '@tanstack/react-query';

/**
 * The single TanStack Query cache of the app. Stores own their query keys;
 * a session change clears the whole cache.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 2 },
  },
});
