import { InjectionToken } from '@angular/core';
import { z } from 'zod';

export interface WebConfig {
  gatewayUrl: string;
  firebase: { apiKey: string; authDomain: string; projectId: string };
}
export const WEB_CONFIG = new InjectionToken<WebConfig>('webConfig');

const originSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.origin === value &&
      (url.protocol === 'https:' ||
        (url.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(url.hostname)))
    );
  });
const configSchema = z.object({
  gatewayUrl: z.union([z.literal('same-origin'), originSchema]),
  firebase: z.object({
    apiKey: z.string().min(1),
    authDomain: z.string().min(1),
    projectId: z.string().min(1),
  }),
});

/** Same-origin mode uses the app's proxy on the device actually opening it. */
export function resolveWebConfig(
  value: unknown,
  applicationOrigin: string,
): WebConfig {
  const config = configSchema.parse(value);
  return {
    ...config,
    gatewayUrl:
      config.gatewayUrl === 'same-origin'
        ? originSchema.parse(applicationOrigin)
        : config.gatewayUrl,
  };
}
