/**
 * Session lifecycle events, the same three the web app dispatches
 * (`apps/web/src/app/domains/auth/api/events`). Subscribe through
 * `onSessionEvent` of the session API.
 */
export type SessionEvent =
  /** The previous scope ended: sign-out, a new user, or a failed check. */
  | { type: 'invalidated'; generation: number }
  /** The gateway verified the same user again (a refreshed ID token). */
  | { type: 'refreshed'; uid: string; generation: number }
  /** The gateway verified a new user; scoped data may load now. */
  | { type: 'established'; uid: string; generation: number };
