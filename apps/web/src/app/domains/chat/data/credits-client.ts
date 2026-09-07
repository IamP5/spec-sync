import { httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { SESSION } from '../../auth/api/session';
import { CREDITS_URL, parseCreditsView } from './credits';

/**
 * Data access for the AI credits wallet. The AI service is the only place
 * that verifies the user, so the read model is one authenticated GET through
 * the `/ai` proxy. Like `ThreadClient` the request stays `undefined` while
 * there is no session scope, so a guest never asks for a wallet.
 */
@Injectable({ providedIn: 'root' })
export class CreditsClient {
  private readonly session = inject(SESSION);

  /** The wallet of the signed-in user, or `{ enabled: false }` when credits are off. */
  walletResource() {
    return httpResource(
      () => (this.session.scope() ? { url: CREDITS_URL } : undefined),
      { parse: parseCreditsView },
    );
  }
}
