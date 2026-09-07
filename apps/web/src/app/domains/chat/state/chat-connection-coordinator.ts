import { computed, inject, Injectable, resource } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CopilotKit } from '@copilotkit/angular';
import { Events } from '@ngrx/signals/events';

import { sessionEvents } from '../../auth/api/events';
import { SESSION } from '../../auth/api/session';
import { WEB_CONFIG } from '../../shared/util-config';
import { BEFORE_CHAT_REQUEST, CHAT_AGENT_ID } from '../data/chat-agent';

/** Prepares authenticated transport while the chat page remains available to guests. */
@Injectable({ providedIn: 'root' })
export class ChatConnectionCoordinator {
  private readonly session = inject(SESSION);
  private readonly copilot = inject(CopilotKit);
  private readonly authenticate = inject(BEFORE_CHAT_REQUEST);
  private readonly config = inject(WEB_CONFIG, { optional: true });
  private readonly connection = resource({
    params: () => this.session.scope() ?? undefined,
    loader: async ({ params, abortSignal }) => {
      await this.authenticate();
      if (abortSignal.aborted || !this.session.isCurrent(params))
        return undefined;
      if (this.config)
        this.copilot.updateRuntime({
          runtimeUrl: `${this.config.gatewayUrl}/ai/copilotkit`,
          credentials: 'omit',
        });
      return params.generation;
    },
  });
  readonly ready = computed(
    () =>
      this.session.authenticated() &&
      this.connection.hasValue() &&
      this.connection.value() === this.session.scope()?.generation,
  );
  readonly error = this.connection.error;
  constructor() {
    if (this.config) this.copilot.updateRuntime({ runtimeTransport: 'single' });
    inject(Events)
      .on(sessionEvents.invalidated)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        const agent = this.copilot.getAgent(CHAT_AGENT_ID);
        if (agent) {
          this.copilot.core.stopAgent({ agent });
          agent.setMessages([]);
          agent.setState({});
        }
        this.copilot.updateRuntime({ headers: {} });
        if (this.config)
          queueMicrotask(() => {
            if (!this.session.authenticated())
              this.copilot.core.setRuntimeUrl(undefined);
          });
      });
  }
  retry() {
    this.connection.reload();
  }
}
