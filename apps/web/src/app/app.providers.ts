import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
} from '@angular/core';
import { CopilotKit } from '@copilotkit/angular';

import { AuthSession } from './domains/auth/api/bootstrap';
import { SESSION } from './domains/auth/api/session';
import { BEFORE_CHAT_REQUEST } from './domains/chat/api/bootstrap';
import { USER_STORAGE_SCOPE } from './domains/user/api/bootstrap';

export function provideUserStorageScope(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: USER_STORAGE_SCOPE, useFactory: createSessionStorageScope },
  ]);
}

export function provideChatAuthentication(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: BEFORE_CHAT_REQUEST,
      useFactory: () => {
        const auth = inject(AuthSession);
        const copilot = inject(CopilotKit);
        const session = inject(SESSION);
        return async () => {
          const scope = session.scope();
          if (!scope) throw new Error('Sign in to continue.');
          const token = await auth.idToken();
          if (!session.isCurrent(scope)) throw new Error('Session changed.');
          copilot.updateRuntime({
            headers: { Authorization: `Bearer ${token}` },
          });
        };
      },
    },
  ]);
}

function createSessionStorageScope(): () => string {
  const session = inject(SESSION);
  return () => {
    const scope = session.scope();
    if (!scope) throw new Error('Sign in to continue.');
    return scope.uid;
  };
}
