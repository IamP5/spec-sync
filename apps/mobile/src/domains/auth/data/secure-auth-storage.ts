import * as SecureStore from 'expo-secure-store';

/**
 * Firebase's persisted user (refresh token included) in the device keychain,
 * shaped like the storage `getReactNativePersistence` expects. Secrets never
 * go to AsyncStorage or SQLite (docs/architecture-state-management.md).
 *
 * SecureStore keys allow only `[A-Za-z0-9._-]` and values should stay under
 * 2048 bytes, so keys are escaped and values are split into chunks.
 */
const CHUNK = 1800;

export function secureKeyOf(key: string): string {
  return `specsync.auth.${key.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

export function chunksOf(value: string, size = CHUNK): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }
  return chunks.length ? chunks : [''];
}

async function removeChunks(key: string): Promise<void> {
  const count = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(`${key}.${index}`),
    ),
  );
  await SecureStore.deleteItemAsync(`${key}.n`);
}

export const secureAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const base = secureKeyOf(key);
    const count = Number(await SecureStore.getItemAsync(`${base}.n`));
    if (!count) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(`${base}.${index}`),
      ),
    );
    return parts.some((part) => part === null) ? null : parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const base = secureKeyOf(key);
    await removeChunks(base);
    const chunks = chunksOf(value);
    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(`${base}.${index}`, chunk),
      ),
    );
    await SecureStore.setItemAsync(`${base}.n`, String(chunks.length));
  },
  async removeItem(key: string): Promise<void> {
    await removeChunks(secureKeyOf(key));
  },
};
