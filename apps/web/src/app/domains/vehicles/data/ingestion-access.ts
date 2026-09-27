import { HttpErrorResponse } from '@angular/common/http';

/**
 * Explains an access failure of the curator endpoints (`/api/ingestions/**`).
 * The gateway forwards the signed-in user's Firebase ID token and the API
 * authorises by its `roles` claim: 401 means the session is missing or
 * expired, 403 means the account lacks the curator role. The browser never
 * checks roles itself; it only explains what the API answered.
 * Returns undefined for any other failure.
 */
export function ingestionAccessMessage(error: unknown): string | undefined {
  if (!(error instanceof HttpErrorResponse)) return undefined;
  if (error.status === 401)
    return $localize`Your session has expired. Sign in again and retry.`;
  if (error.status === 403)
    return $localize`Your account does not have the curator role. Ask an administrator for access, then sign in again.`;
  return undefined;
}
