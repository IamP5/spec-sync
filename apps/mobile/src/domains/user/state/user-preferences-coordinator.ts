import {
  initialsOf,
  MAX_DISPLAY_NAME_LENGTH,
  type Preferences,
} from '../data/preferences';
import { usePreferencesDetailStore } from './preferences-detail-store';

/**
 * The public face of the user's preferences (web `UserPreferencesCoordinator`):
 * the chat reads the mode, effort, greeting name and activity switch; the
 * settings screen edits them.
 */
export function useUserPreferencesCoordinator() {
  const store = usePreferencesDetailStore();
  return {
    theme: store.theme,
    displayName: store.displayName,
    hasName: store.displayName.trim().length > 0,
    initials: initialsOf(store.displayName),
    showActivity: store.showActivity,
    mode: store.mode,
    effort: store.effort,
    error: store.error,
    signedIn: store.signedIn,
    maxDisplayNameLength: MAX_DISPLAY_NAME_LENGTH,
    update: (changes: Partial<Preferences>) => store.update(changes),
    setTheme: (theme: Preferences['theme']) => store.update({ theme }),
  };
}
