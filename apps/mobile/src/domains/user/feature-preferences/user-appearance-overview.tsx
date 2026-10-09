import { useUserPreferencesCoordinator } from '../api/preferences';

/**
 * Applies the signed-in user's appearance on every screen, not only on the
 * screens that read preferences (the web app applies it at the shell).
 * Rendered once by the root layout; it has no UI of its own.
 */
export function UserAppearanceOverview() {
  useUserPreferencesCoordinator();
  return null;
}
