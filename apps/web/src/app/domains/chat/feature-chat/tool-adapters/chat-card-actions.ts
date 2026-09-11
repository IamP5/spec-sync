import { InjectionToken } from '@angular/core';

/** Cards prepare drafts or request an explicit action; the page owns sending. */
export interface ChatCardActions {
  draft: (prompt: string) => void;
  send: (prompt: string) => void;
  canSend?: () => boolean;
}

export const CHAT_CARD_ACTIONS = new InjectionToken<ChatCardActions>(
  'Chat card actions',
);
