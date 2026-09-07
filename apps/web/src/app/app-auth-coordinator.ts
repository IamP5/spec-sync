import { effect, inject, Injectable } from '@angular/core';
import { CopilotKit } from '@copilotkit/angular';

import { AuthSession, WEB_CONFIG } from './domains/auth/data/auth-session';

/** CopilotKit uses its own transport, outside Angular's HTTP interceptor chain. */
@Injectable({ providedIn: 'root' })
export class AppAuthCoordinator {
  private readonly auth = inject(AuthSession);
  private readonly config = inject(WEB_CONFIG);
  private readonly copilot = inject(CopilotKit);
  constructor() {
    effect(() => {
      const token = this.auth.token();
      if (token)
        this.copilot.updateRuntime({
          runtimeUrl: `${this.config.gatewayUrl}/ai/copilotkit`,
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'omit',
        });
    });
  }
}
