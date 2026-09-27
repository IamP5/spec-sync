import { useMutation } from '@tanstack/react-query';

import { useSession } from '../api/session';
import {
  retrySessionCheck,
  signInConfigured,
  signInWithGoogleIdToken,
  signInWithGooglePopup,
  signInWithPopupAvailable,
  signOutOfFirebase,
} from '../data/auth-client';
import { useGoogleIdTokenPrompt } from '../data/google-sign-in';
import {
  SESSION_CHECK_FAILED,
  signInErrorMessage,
} from '../data/sign-in-error';

/**
 * Signing in with Google and signing out (the mobile side of the web
 * `AuthSessionCoordinator`): pending and error states for the buttons, and
 * the sentence to show when something failed.
 */
export function useAuthLoginStore() {
  const snapshot = useSession();
  const google = useGoogleIdTokenPrompt();

  const login = useMutation({
    mutationFn: async () => {
      if (signInWithPopupAvailable) {
        await signInWithGooglePopup();
        return;
      }
      const token = await google.prompt();
      if (token) await signInWithGoogleIdToken(token);
    },
  });
  const logout = useMutation({ mutationFn: signOutOfFirebase });

  const unavailable = !signInConfigured
    ? 'Sign-in is not configured for this build. Set the EXPO_PUBLIC_FIREBASE_* variables.'
    : google.unavailable;
  const checking =
    snapshot.status === 'restoring' || snapshot.status === 'verifying';

  return {
    status: snapshot.status,
    authenticated: snapshot.scope !== null,
    pending: login.isPending || checking,
    checking,
    canSignIn: !unavailable && google.ready && !login.isPending && !checking,
    unavailable,
    signInError: login.error
      ? signInErrorMessage(login.error)
      : snapshot.status === 'error'
        ? SESSION_CHECK_FAILED
        : undefined,
    sessionFailed: snapshot.status === 'error' && !login.error,
    logoutPending: logout.isPending,
    /** This screen signed the user out (not merely: nobody is signed in). */
    signedOut: logout.isSuccess,
    logoutError: logout.error
      ? 'We couldn’t sign you out. Please try again.'
      : undefined,
    login: () => login.mutate(),
    retry: retrySessionCheck,
    logout: () => logout.mutate(),
  };
}
