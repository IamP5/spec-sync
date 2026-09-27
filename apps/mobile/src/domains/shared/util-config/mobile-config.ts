import { z } from 'zod';

/**
 * Runtime configuration of the mobile app. Expo inlines `EXPO_PUBLIC_*`
 * variables at build time, so this holds public values only; secrets never
 * belong here.
 *
 * The app talks to the backend exclusively through the gateway (the same
 * contract as the web app: `/api`, `/ai`, `/auth`, `/user`). Native code has
 * no origin, so the gateway URL is always absolute.
 */
export interface MobileConfig {
  gatewayUrl: string;
  /**
   * The Identity Platform (Firebase) project the gateway verifies ID tokens
   * against; the same values as the web app's `app-config.json`. Missing in a
   * build without sign-in, which then explains that sign-in is unavailable.
   */
  firebase: FirebaseConfig | undefined;
  /**
   * OAuth client ids for Google sign-in on native builds (expo-auth-session).
   * The web build signs in with the Firebase popup and needs none.
   */
  googleClientIds: GoogleClientIds;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
}

export interface GoogleClientIds {
  ios?: string;
  android?: string;
  web?: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);

const gatewayUrl = z
  .string()
  .url()
  .transform((value) => value.replace(/\/+$/, ''))
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))
    );
  }, 'The gateway URL must use https (http is allowed for local hosts only).');

const firebaseConfig = z.object({
  apiKey: z.string().min(1),
  authDomain: z.string().min(1),
  projectId: z.string().min(1),
});

/**
 * The local gateway (`nx serve gateway`, port 3000) as seen from a simulator:
 * the Android emulator reaches the host machine through 10.0.2.2.
 */
function developmentGatewayUrl(os: string | undefined): string {
  return os === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
}

function present(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

export function resolveMobileConfig(env: {
  gatewayUrl?: string;
  os?: string;
  development: boolean;
  firebase?: Partial<FirebaseConfig>;
  googleClientIds?: GoogleClientIds;
}): MobileConfig {
  const raw =
    env.gatewayUrl ||
    (env.development ? developmentGatewayUrl(env.os) : undefined);
  if (!raw) {
    throw new Error(
      'EXPO_PUBLIC_GATEWAY_URL is not set. Release builds need the gateway URL.',
    );
  }
  const firebase = firebaseConfig.safeParse(env.firebase ?? {});
  return {
    gatewayUrl: gatewayUrl.parse(raw),
    firebase: firebase.success ? firebase.data : undefined,
    googleClientIds: {
      ios: present(env.googleClientIds?.ios),
      android: present(env.googleClientIds?.android),
      web: present(env.googleClientIds?.web),
    },
  };
}

export const mobileConfig: MobileConfig = resolveMobileConfig({
  gatewayUrl: process.env.EXPO_PUBLIC_GATEWAY_URL,
  os: process.env.EXPO_OS,
  development: __DEV__,
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  },
  googleClientIds: {
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  },
});
