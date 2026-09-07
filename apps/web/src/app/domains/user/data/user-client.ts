import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { type UserConfiguration, userSchema } from './user';

@Injectable({ providedIn: 'root' })
export class UserClient {
  profileResource() {
    return httpResource(() => '/user/me', { parse: userSchema.parse });
  }
  configuration(uid: string): UserConfiguration {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem(`specsync.user.${uid}.configuration`) ?? '{}',
      );
      const parsed =
        typeof value === 'object' && value !== null && 'theme' in value
          ? value.theme
          : undefined;
      return {
        theme: parsed === 'light' || parsed === 'dark' ? parsed : 'system',
      };
    } catch {
      return { theme: 'system' };
    }
  }
  saveConfiguration(uid: string, configuration: UserConfiguration): void {
    localStorage.setItem(
      `specsync.user.${uid}.configuration`,
      JSON.stringify(configuration),
    );
  }
}
