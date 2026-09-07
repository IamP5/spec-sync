import { InjectionToken } from '@angular/core';

/** The shell provides the signed-in user ID; local test agents retain their fixture keys. */
export const CHAT_STORAGE_SCOPE = new InjectionToken<() => string>(
  'chatStorageScope',
  { providedIn: 'root', factory: () => () => '' },
);
