import { InjectionToken } from '@angular/core';

export const USER_STORAGE_SCOPE = new InjectionToken<() => string>(
  'userStorageScope',
  { factory: () => () => '' },
);
