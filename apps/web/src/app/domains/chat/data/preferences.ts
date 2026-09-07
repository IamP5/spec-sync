/** What the user can configure in the settings dialog. The theme is handled by the design system. */
export interface Preferences {
  /** Shown in the sidebar and used to greet the user; empty means anonymous. */
  displayName: string;
  /** Show thinking summaries and tool activity in the transcript. */
  showActivity: boolean;
  /**
   * Id of the model the assistant answers with (see `chat-model.ts`); empty
   * leaves the choice to the AI service. Picked in the composer.
   */
  model: string;
  /**
   * Id of the reasoning effort the assistant thinks with (see
   * `chat-model.ts`); empty leaves it to the AI service. Picked in the composer.
   */
  effort: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  displayName: '',
  showActivity: true,
  model: '',
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
