/** The browser's `localStorage`, like the web app keeps preferences. */
export const preferencesStorage: Pick<Storage, 'getItem' | 'setItem'> =
  globalThis.localStorage;
