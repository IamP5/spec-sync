import { parsePreferences, type Preferences } from './preferences';
import { preferencesStorage } from './preferences-storage';

/** Same key as the web app, scoped to the signed-in user. */
const STORAGE_KEY = 'specsync.chat.preferences.v1';

function keyOf(uid: string): string {
  return `${STORAGE_KEY}.${encodeURIComponent(uid)}`;
}

/** Reads the user's preferences; invalid or missing fields fall back to defaults. */
export function loadPreferences(uid: string): Preferences {
  try {
    return parsePreferences(preferencesStorage.getItem(keyOf(uid)));
  } catch {
    return parsePreferences(null);
  }
}

/** Saves the preferences; false when the device refused the write. */
export function savePreferences(
  uid: string,
  preferences: Preferences,
): boolean {
  try {
    preferencesStorage.setItem(keyOf(uid), JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}
