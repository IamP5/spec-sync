import { InjectionToken } from '@angular/core';

/** Cards propose a draft; the page owns the composer and sending. */
export const CHAT_CARD_ACTIONS = new InjectionToken<{
  draft: (prompt: string) => void;
}>('Chat card actions');
