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

/**
 * The local gateway (`nx serve gateway`, port 3000) as seen from a simulator:
 * the Android emulator reaches the host machine through 10.0.2.2.
 */
function developmentGatewayUrl(os: string | undefined): string {
  return os === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
}

export function resolveMobileConfig(env: {
  gatewayUrl?: string;
  os?: string;
  development: boolean;
}): MobileConfig {
  const raw =
    env.gatewayUrl ||
    (env.development ? developmentGatewayUrl(env.os) : undefined);
  if (!raw) {
    throw new Error(
      'EXPO_PUBLIC_GATEWAY_URL is not set. Release builds need the gateway URL.',
    );
  }
  return { gatewayUrl: gatewayUrl.parse(raw) };
}

export const mobileConfig: MobileConfig = resolveMobileConfig({
  gatewayUrl: process.env.EXPO_PUBLIC_GATEWAY_URL,
  os: process.env.EXPO_OS,
  development: __DEV__,
});
