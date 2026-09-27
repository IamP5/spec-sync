import { z } from 'zod';

/** `GET /user/me`, answered by the gateway from the verified ID token. */
export const USER_PROFILE_PATH = '/user/me';

export const userSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string(),
  photoUrl: z
    .string()
    .url()
    .refine((url) => url.startsWith('https://'))
    .nullable(),
  roles: z.array(z.string().regex(/^[a-z][a-z0-9:_-]{0,63}$/)).max(32),
});

export type User = z.infer<typeof userSchema>;
