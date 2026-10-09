import { useEffect } from 'react';

import { queryClient } from '../../shared/util-query/query-cache';
import { onSessionEvent } from '../api/session';
import { startSessionSync } from '../data/auth-client';

/**
 * Keeps the session in step with Firebase for as long as the app runs, and
 * clears the query cache whenever a session ends, so no data of the previous
 * user survives (docs/architecture-state-management.md). It is mounted once,
 * by `AuthSessionOverview` in the root layout.
 */
export function useAuthSessionStore(): void {
  useEffect(() => {
    const stopClearing = onSessionEvent((event) => {
      if (event.type === 'invalidated') queryClient.removeQueries();
    });
    const stopSync = startSessionSync();
    return () => {
      stopSync();
      stopClearing();
    };
  }, []);
}
