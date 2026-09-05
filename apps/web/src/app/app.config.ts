import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideCopilotKit } from '@copilotkit/angular';

import { provideZard } from '@/ui/core';

import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
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
