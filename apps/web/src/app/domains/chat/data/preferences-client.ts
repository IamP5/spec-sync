import { Injectable } from '@angular/core';

import { DEFAULT_PREFERENCES, Preferences } from './preferences';

const STORAGE_KEY = 'specsync.chat.preferences.v1';

/**
 * Data access for the user preferences, kept in the browser's local storage
 * next to the conversation history. Stateless: reads and writes go straight
 * to storage, the store mirrors the result.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesClient {
  load(): Preferences {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      const stored = raw ? (JSON.parse(raw) as Partial<Preferences>) : {};
      return {
        displayName:
          typeof stored.displayName === 'string'
            ? stored.displayName
            : DEFAULT_PREFERENCES.displayName,
        showActivity:
          typeof stored.showActivity === 'boolean'
            ? stored.showActivity
            : DEFAULT_PREFERENCES.showActivity,
      };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  save(preferences: Preferences): boolean {
    try {
      globalThis.localStorage?.setItem(
        STORAGE_KEY,
        JSON.stringify(preferences),
      );
      return true;
    } catch {
      return false;
    }
  }
}
