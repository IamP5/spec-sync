/**
 * The sentence shown for a failed Google sign-in, with the same wording as
 * the web `AuthSessionCoordinator`. Firebase error codes are kept visible so
 * support can act on them.
 */
export function signInErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^auth\/[\w<>.-]{1,80}$/.test(error.code)
      ? error.code
      : undefined;
  if (code === 'auth/popup-blocked')
    return 'Google sign-in was blocked by this browser. Open SpecSync directly in Safari or Chrome and try again.';
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  )
    return 'The Google sign-in window closed before sign-in finished. Please try again.';
  if (code === 'auth/unauthorized-domain')
    return 'This address is not authorized for Google sign-in. Please contact the app administrator. (auth/unauthorized-domain)';
  return code
    ? `Google sign-in failed (${code}). Please try again or share this code with support.`
    : 'Google sign-in could not finish. Please try again.';
}

/** Shown when the gateway refused to verify the Firebase user. */
export const SESSION_CHECK_FAILED =
  'SpecSync could not verify your session with its server. Try again in a moment.';
