import { useAuthSessionStore } from './auth-session-store';

/**
 * Keeps the session verified while the app runs (the web starts its
 * `AuthSessionCoordinator` eagerly at boot). Rendered once by the root
 * layout; it has no UI of its own.
 */
export function AuthSessionOverview() {
  useAuthSessionStore();
  return null;
}
