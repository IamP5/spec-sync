import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideCopilotKit } from '@copilotkit/angular';

import { provideZard } from '@/ui/core';

import {
  provideChatAuthentication,
  provideUserStorageScope,
} from './app.providers';
import { appRoutes } from './app.routes';
import { AuthSessionCoordinator } from './domains/auth/api/authentication';
import { authInterceptor } from './domains/auth/api/bootstrap';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideUserStorageScope(),
    provideChatAuthentication(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideEnvironmentInitializer(() => {
      inject(AuthSessionCoordinator);
    }),
    provideRouter(appRoutes, withComponentInputBinding()),
    // Zard's event-manager plugins (`(click.prevent-with-stop)`,
    // `(keydown.{enter,space})`, debounced events) and the theme bootstrap.
    provideZard(),
    // AG-UI client (CopilotKit). Its services are root-scoped, so the
    // configuration has to live here; the chat feature connects the runtime
    // URL lazily when the page is opened. The development inspector overlay
    // is off: it covers the page header and reports telemetry.
    provideCopilotKit({ enableInspector: false }),
  ],
};
