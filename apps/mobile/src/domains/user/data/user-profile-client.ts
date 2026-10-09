import { gatewayJson } from '../../auth/api/session';
import { type User, USER_PROFILE_PATH, userSchema } from './user';

/** The signed-in user's Google profile as the gateway verified it. */
export function fetchUserProfile(signal?: AbortSignal): Promise<User> {
  return gatewayJson(USER_PROFILE_PATH, (value) => userSchema.parse(value), {
    signal,
  });
}
