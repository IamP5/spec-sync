import { resource } from '@angular/core';

import type { User } from '../domains/user/data/user';
import { UserProfileClient } from '../domains/user/data/user-profile-client';

export const testUser: User = {
  uid: 'alice',
  email: 'alice@example.com',
  displayName: 'Alice Smith',
  photoUrl: 'https://lh3.googleusercontent.com/alice',
  roles: ['reviewer'],
};
export function provideFakeUser(user: User | null = testUser) {
  return {
    provide: UserProfileClient,
    useValue: {
      profileResource: () =>
        resource({
          defaultValue: user ?? undefined,
          loader: async () => user ?? undefined,
        }),
    },
  };
}
