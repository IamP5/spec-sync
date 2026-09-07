import { httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { z } from 'zod';

import { AuthSession } from './auth-session';

@Injectable({ providedIn: 'root' })
export class AuthClient {
  private readonly session = inject(AuthSession);
  readonly ready = this.session.ready;
  sessionResource() {
    return httpResource(
      () => (this.session.token() ? '/auth/session' : undefined),
      {
        parse: z.object({ uid: z.string().min(1) }).parse,
      },
    );
  }
  login() {
    return this.session.login();
  }
  logout() {
    return this.session.logout();
  }
}
