import {
  type ChatMode,
  DEFAULT_CHAT_MODE,
  isChatMode,
} from '../../chat/api/contracts';

export type ThemePreference = 'light' | 'dark' | 'system';

/** What the user can configure (web `Preferences`). */
export interface Preferences {
  theme: ThemePreference;
  /** Optional chat greeting name; the account name and avatar come from Google. */
  displayName: string;
  /** Show thinking summaries and tool activity in the transcript. */
  showActivity: boolean;
  /** The mode the assistant answers in (see chat `chat-model.ts`). */
  mode: ChatMode;
  /** Id of the reasoning effort; empty leaves it to the AI service. */
  effort: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  displayName: '',
  showActivity: true,
  mode: DEFAULT_CHAT_MODE,
  effort: '',
};

export const MAX_DISPLAY_NAME_LENGTH = 40;

/** Stored preferences, field by field, with the defaults for anything invalid. */
export function parsePreferences(raw: string | null): Preferences {
  try {
    const stored: unknown = raw ? JSON.parse(raw) : {};
    const value =
      stored && typeof stored === 'object'
        ? (stored as Record<string, unknown>)
        : {};
    const { theme, displayName, showActivity, mode, effort } = value;
    return {
      theme: theme === 'light' || theme === 'dark' ? theme : 'system',
      displayName:
        typeof displayName === 'string'
          ? displayName.slice(0, MAX_DISPLAY_NAME_LENGTH)
          : DEFAULT_PREFERENCES.displayName,
      showActivity:
        typeof showActivity === 'boolean'
          ? showActivity
          : DEFAULT_PREFERENCES.showActivity,
      mode:
        typeof mode === 'string' && isChatMode(mode)
          ? mode
          : DEFAULT_PREFERENCES.mode,
      effort: typeof effort === 'string' ? effort : DEFAULT_PREFERENCES.effort,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/** Up to two initials for the avatar, or a placeholder when there is no name. */
export function initialsOf(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (part[0] ?? '').toLocaleUpperCase())
    .join('');
  return initials || 'U';
}
