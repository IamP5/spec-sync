import { inject, Injectable } from '@angular/core';

import {
  isChatMode,
  isModelRole,
  type RoleModels,
} from '../../chat/api/contracts';
import { USER_STORAGE_SCOPE } from '../util/storage-scope';
import { DEFAULT_PREFERENCES, Preferences } from './preferences';

const STORAGE_KEY = 'specsync.chat.preferences.v1';

/**
 * Data access for the user preferences, kept in the browser's local storage
 * next to the conversation history. Stateless: reads and writes go straight
 * to storage, the store mirrors the result.
 */
@Injectable({ providedIn: 'root' })
export class UserPreferencesClient {
  private readonly scope = inject(USER_STORAGE_SCOPE);
  private key(): string {
    const scope = this.scope();
    return scope ? `${STORAGE_KEY}.${encodeURIComponent(scope)}` : STORAGE_KEY;
  }

  load(): Preferences {
    try {
      const raw = globalThis.localStorage?.getItem(this.key());
      const stored = raw
        ? (JSON.parse(raw) as Partial<Preferences> & { model?: unknown })
        : {};
      const legacy = this.legacyTheme();
      const theme =
        stored.theme ??
        (typeof legacy === 'object' && legacy !== null && 'theme' in legacy
          ? legacy.theme
          : undefined);
      return {
        theme: theme === 'light' || theme === 'dark' ? theme : 'system',
        displayName:
          typeof stored.displayName === 'string'
            ? stored.displayName
            : DEFAULT_PREFERENCES.displayName,
        showActivity:
          typeof stored.showActivity === 'boolean'
            ? stored.showActivity
            : DEFAULT_PREFERENCES.showActivity,
        mode:
          typeof stored.mode === 'string' && isChatMode(stored.mode)
            ? stored.mode
            : DEFAULT_PREFERENCES.mode,
        roleModels: roleModelsOf(stored.roleModels, stored.model),
        effort:
          typeof stored.effort === 'string'
            ? stored.effort
            : DEFAULT_PREFERENCES.effort,
      };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  private legacyTheme(): unknown {
    try {
      return JSON.parse(
        globalThis.localStorage?.getItem(
          `specsync.user.${this.scope()}.configuration`,
        ) ?? '{}',
      );
    } catch {
      return {};
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

/**
 * The stored overrides, keeping only known roles with a non-empty model id.
 * The single `model` preference of the first release named the model the chat
 * answered with, which is exactly the `chat` role; it is migrated here and
 * never written back, so it disappears with the next save.
 */
function roleModelsOf(stored: unknown, legacyModel: unknown): RoleModels {
  const entries =
    typeof stored === 'object' && stored !== null
      ? Object.entries(stored as Record<string, unknown>).filter(
          (entry): entry is [string, string] =>
            isModelRole(entry[0]) &&
            typeof entry[1] === 'string' &&
            entry[1] !== '',
        )
      : [];
  const roleModels: RoleModels = Object.fromEntries(entries);
  if (!roleModels.chat && typeof legacyModel === 'string' && legacyModel) {
    roleModels.chat = legacyModel;
  }
  return roleModels;
}
