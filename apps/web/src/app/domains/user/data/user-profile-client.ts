import { httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { SESSION } from '../../auth/api/session';
import { userSchema } from './user';

@Injectable({ providedIn: 'root' })
export class UserProfileClient {
  private readonly session = inject(SESSION);
  profileResource() {
    return httpResource(
      () => (this.session.scope() ? { url: '/user/me' } : undefined),
      { parse: userSchema.parse },
    );
  }
}
