import { resource } from '@angular/core';

import type { User } from '../domains/user/data/user';
import { UserClient } from '../domains/user/data/user-client';

export const testUser: User = {
  uid: 'alice',
  email: 'alice@example.com',
  displayName: 'Alice Smith',
  photoUrl: 'https://lh3.googleusercontent.com/alice',
  roles: ['reviewer'],
};
export function provideFakeUser(user: User | null = testUser) {
  return {
    provide: UserClient,
    useValue: {
      profileResource: () =>
        resource({
          defaultValue: user ?? undefined,
          loader: async () => user ?? undefined,
        }),
      configuration: () => ({
        theme: localStorage.getItem('theme') ?? 'system',
      }),
      saveConfiguration: () => undefined,
    },
  };
}
