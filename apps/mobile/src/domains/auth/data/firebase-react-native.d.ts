// Firebase ships `getReactNativePersistence` only in its React Native build
// (the `react-native` export condition Metro resolves), and the public typings
// omit it. Declare it so the native auth setup type-checks.
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
