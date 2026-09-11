import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { resolveWebConfig, WEB_CONFIG } from './app/domains/shared/util-config';

// Runtime configuration allows one immutable image to serve every environment.
async function bootstrap() {
  const response = await fetch('/app-config.json', {
    cache: 'no-store',
    credentials: 'omit',
  });
  if (!response.ok)
    throw new Error('Application configuration is unavailable.');
  const config = resolveWebConfig(await response.json(), location.origin);
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
