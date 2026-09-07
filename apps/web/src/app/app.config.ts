import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { CopilotKit, provideCopilotKit } from '@copilotkit/angular';

import { provideZard } from '@/ui/core';

import { appRoutes } from './app.routes';
import { AppAuthCoordinator } from './app-auth-coordinator';
import { AuthSession } from './domains/auth/data/auth-session';
import { BEFORE_CHAT_REQUEST } from './domains/chat/data/chat-agent';
import { CHAT_STORAGE_SCOPE } from './domains/chat/util/storage-scope';
import { USER_STORAGE_SCOPE } from './domains/user/util/storage-scope';
import { gatewayInterceptor } from './gateway-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    {
      provide: CHAT_STORAGE_SCOPE,
      useFactory: () => {
        const auth = inject(AuthSession);
        return () => auth.userId();
      },
    },
    {
      provide: USER_STORAGE_SCOPE,
      useFactory: () => {
        const auth = inject(AuthSession);
        return () => auth.userId();
      },
    },
    {
      provide: BEFORE_CHAT_REQUEST,
      useFactory: () => {
        const auth = inject(AuthSession);
        const copilot = inject(CopilotKit);
        return async () => {
          copilot.core.setHeaders({
            Authorization: `Bearer ${await auth.idToken()}`,
          });
        };
      },
    },
    provideHttpClient(withInterceptors([gatewayInterceptor])),
    provideEnvironmentInitializer(() => {
      inject(AppAuthCoordinator);
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
