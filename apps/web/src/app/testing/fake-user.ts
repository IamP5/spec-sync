import { resource } from '@angular/core';

import { PhotoClient } from '../domains/user/data/photo-client';
import type { User } from '../domains/user/data/user';
import { UserProfileClient } from '../domains/user/data/user-profile-client';

export const testUser: User = {
  uid: 'alice',
  email: 'alice@example.com',
  displayName: 'Alice Smith',
  photoUrl: 'https://lh3.googleusercontent.com/alice',
  roles: ['reviewer'],
};

/** A profile that resolves at once; photos decode instantly unless `preload` says otherwise. */
export function provideFakeUser(
  user: User | null = testUser,
  preload: (url: string) => Promise<boolean> = async () => true,
) {
  return [
    {
      provide: UserProfileClient,
      useValue: {
        profileResource: () =>
          resource({
            defaultValue: user ?? undefined,
            loader: async () => user ?? undefined,
          }),
      },
    },
    {
      provide: PhotoClient,
      useValue: {
        preloadResource: (url: () => string | null | undefined) =>
          resource({
            params: () => url() ?? undefined,
            loader: async ({ params }) => ({
              url: params,
              shown: await preload(params),
            }),
          }),
      },
    },
  ];
}
