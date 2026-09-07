import { bootstrapApplication } from '@angular/platform-browser';
import { z } from 'zod';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { WEB_CONFIG } from './app/domains/shared/util-config';

const origin = z
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
  gatewayUrl: origin,
  firebase: z.object({
    apiKey: z.string().min(1),
    authDomain: z.string().min(1),
    projectId: z.string().min(1),
  }),
});

// Runtime configuration allows one immutable image to serve every environment.
async function bootstrap() {
  const response = await fetch('/app-config.json', {
    cache: 'no-store',
    credentials: 'omit',
  });
  if (!response.ok)
    throw new Error('Application configuration is unavailable.');
  const config = configSchema.parse(await response.json());
  await bootstrapApplication(App, {
    providers: [
      ...appConfig.providers,
      { provide: WEB_CONFIG, useValue: config },
    ],
  });
}
bootstrap().catch(() => {
  document.body.textContent =
    'SpecSync could not start. Please refresh or try again later.';
});
