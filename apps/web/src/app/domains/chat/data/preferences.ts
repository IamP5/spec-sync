/** What the user can configure in the settings dialog. The theme is handled by the design system. */
export interface Preferences {
  /** Shown in the sidebar and used to greet the user; empty means anonymous. */
  displayName: string;
  /** Show thinking summaries and tool activity in the transcript. */
  showActivity: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  displayName: '',
  showActivity: true,
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
