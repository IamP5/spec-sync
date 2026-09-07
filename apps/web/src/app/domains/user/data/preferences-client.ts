import { inject, Injectable } from '@angular/core';

import { USER_STORAGE_SCOPE } from '../util/storage-scope';
import { DEFAULT_PREFERENCES, Preferences } from './preferences';

const STORAGE_KEY = 'specsync.chat.preferences.v1';

/**
 * Data access for the user preferences, kept in the browser's local storage
 * next to the conversation history. Stateless: reads and writes go straight
 * to storage, the store mirrors the result.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesClient {
  private readonly scope = inject(USER_STORAGE_SCOPE);
  private key(): string {
    const scope = this.scope();
    return scope ? `${STORAGE_KEY}.${encodeURIComponent(scope)}` : STORAGE_KEY;
  }

  load(): Preferences {
    try {
      const raw = globalThis.localStorage?.getItem(this.key());
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
        model:
          typeof stored.model === 'string'
            ? stored.model
            : DEFAULT_PREFERENCES.model,
        effort:
          typeof stored.effort === 'string'
            ? stored.effort
            : DEFAULT_PREFERENCES.effort,
      };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  save(preferences: Preferences): boolean {
    try {
      globalThis.localStorage?.setItem(this.key(), JSON.stringify(preferences));
      return true;
    } catch {
      return false;
    }
  }
}
