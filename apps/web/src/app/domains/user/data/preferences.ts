import { type ChatMode, DEFAULT_CHAT_MODE } from '../../chat/api/contracts';

/** What the user can configure in the settings dialog. The theme is handled by the design system. */
export interface Preferences {
  theme: 'light' | 'dark' | 'system';
  /** Optional chat greeting name; the account name and avatar come from Google. */
  displayName: string;
  /** Show thinking summaries and tool activity in the transcript. */
  showActivity: boolean;
  /**
   * The mode the assistant answers in (see `chat-model.ts`). A mode is a map
   * from role to model owned by the AI service. Picked in the composer.
   */
  mode: ChatMode;
  /**
   * Id of the reasoning effort the assistant thinks with (see
   * `chat-model.ts`); empty leaves it to the AI service. Picked in the composer.
   */
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

/** Up to two initials for the avatar, or a placeholder when there is no name. */
export function initialsOf(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase())
    .join('');
  return initials || 'U';
}
