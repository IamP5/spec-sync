import { fetch } from 'expo/fetch';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithCredential,
  signOut,
  type User,
} from 'firebase/auth';
import { z } from 'zod';

import { mobileConfig } from '../../shared/util-config/mobile-config';
import { sessionContext } from '../session/session-context';
import { initializePlatformAuth, popupSignIn } from './firebase-platform';

/** Gateway route that verifies the Firebase user (`apps/gateway`). */
export const AUTH_SESSION_PATH = '/auth/session';

const verifiedSessionSchema = z.object({ uid: z.string().min(1) });

let auth: Auth | undefined;
let reverify: (() => void) | undefined;

/** Firebase Auth for the configured project, or nothing without one. */
function firebaseAuth(): Auth | undefined {
  const config = mobileConfig.firebase;
  if (!config) return undefined;
  if (!auth) {
    const app = getApps().length ? getApp() : initializeApp(config);
    auth = initializePlatformAuth(app);
  }
  return auth;
}

/** Whether this build can sign in at all (a Firebase project is configured). */
export const signInConfigured = mobileConfig.firebase !== undefined;

/** Whether Google sign-in opens the Firebase popup (web) or a native flow. */
export const signInWithPopupAvailable = popupSignIn !== undefined;

/**
 * Keeps the session in step with Firebase (a port of the web `AuthClient`):
 * every user or token change is verified with the gateway before the session
 * becomes usable, and a stale verification is discarded by its generation.
 * Returns the unsubscribe function.
 */
export function startSessionSync(): () => void {
  const instance = firebaseAuth();
  if (!instance) {
    sessionContext.begin(null);
    return () => undefined;
  }
  sessionContext.useTokenSource(() => idToken(instance));
  let request: AbortController | undefined;
  const verify = (user: User | null) => {
    request?.abort();
    const generation = sessionContext.begin(user?.uid ?? null);
    if (!user) return;
    const controller = new AbortController();
    request = controller;
    verifySession(user, controller.signal).then(
      (uid) => {
        if (uid === user.uid) sessionContext.establish(uid, generation);
        else sessionContext.reject(generation);
      },
      () => {
        if (!controller.signal.aborted) sessionContext.reject(generation);
      },
    );
  };
  const unsubscribe = onIdTokenChanged(instance, verify);
  reverify = () => verify(instance.currentUser);
  return () => {
    reverify = undefined;
    request?.abort();
    unsubscribe();
  };
}

/** Checks the signed-in user with the gateway again after a failed check. */
export function retrySessionCheck(): void {
  reverify?.();
}

async function verifySession(user: User, signal: AbortSignal) {
  const token = await user.getIdToken();
  const response = await fetch(
    `${mobileConfig.gatewayUrl}${AUTH_SESSION_PATH}`,
    {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'omit',
      signal,
    },
  );
  if (!response.ok)
    throw new Error(`Session check failed (${response.status}).`);
  return verifiedSessionSchema.parse(await response.json()).uid;
}

async function idToken(instance: Auth): Promise<string> {
  await instance.authStateReady();
  const user = instance.currentUser;
  if (!user) throw new Error('Sign in to continue.');
  const token = await user.getIdToken();
  if (instance.currentUser !== user) throw new Error('Session changed.');
  return token;
}

/** Web: the Firebase Google popup. */
export async function signInWithGooglePopup(): Promise<void> {
  const instance = firebaseAuth();
  if (!instance || !popupSignIn) throw new Error('Sign-in is not configured.');
  await popupSignIn(instance);
}

/** Native: a Google ID token from expo-auth-session, exchanged with Firebase. */
export async function signInWithGoogleIdToken(googleIdToken: string) {
  const instance = firebaseAuth();
  if (!instance) throw new Error('Sign-in is not configured.');
  await signInWithCredential(
    instance,
    GoogleAuthProvider.credential(googleIdToken),
  );
}

/** Ends the session first, so no request of the old user is still accepted. */
export async function signOutOfFirebase(): Promise<void> {
  const instance = firebaseAuth();
  sessionContext.invalidate();
  if (instance) await signOut(instance);
}
