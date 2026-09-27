import 'expo-sqlite/localStorage/install';

/**
 * Key-value storage for preferences on iOS and Android: `expo-sqlite`'s
 * `localStorage` (docs/architecture-state-management.md: preferences never
 * go to AsyncStorage). The web build uses the browser's own storage.
 */
export const preferencesStorage: Pick<Storage, 'getItem' | 'setItem'> =
  globalThis.localStorage;
