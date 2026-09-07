import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { GoogleAuth } from 'google-auth-library';

import type { GatewayConfig } from './config.js';

export interface UserIdentity {
  uid: string;
  email: string;
  roles: string[];
}
export interface IdentityService {
  signIn(code: string, verifier: string): Promise<string>;
  verifySession(cookie: string): Promise<UserIdentity>;
  invocationToken(audience: string): Promise<string>;
}
export const SESSION_SECONDS = 24 * 60 * 60;

export function rolesFromClaims(value: unknown): string[] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > 32 ||
    !value.every(
      (role): role is string =>
        typeof role === 'string' && /^[a-z][a-z0-9:_-]{0,63}$/.test(role),
    )
  )
    throw new Error('Invalid roles claim');
  return [...new Set(value)];
}

export function createIdentityService(config: GatewayConfig): IdentityService {
  const auth = getAuth(
    initializeApp({
      credential: applicationDefault(),
      projectId: config.projectId,
    }),
  );
  const google = new GoogleAuth();
  const clients = new Map<string, ReturnType<GoogleAuth['getIdTokenClient']>>();
  async function post(
    url: string,
    body: URLSearchParams | object,
  ): Promise<Record<string, unknown>> {
    const form = body instanceof URLSearchParams;
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        'content-type': form
          ? 'application/x-www-form-urlencoded'
          : 'application/json',
      },
      body: form ? body : JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Identity provider rejected sign-in');
    return response.json() as Promise<Record<string, unknown>>;
  }
  return {
    async signIn(code, verifier) {
      const callback = `${config.publicOrigin}/auth/callback`;
      const googleTokens = await post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          code,
          code_verifier: verifier,
          client_id: config.googleClientId,
          client_secret: config.googleClientSecret,
          redirect_uri: callback,
          grant_type: 'authorization_code',
        }),
      );
      if (typeof googleTokens['id_token'] !== 'string')
        throw new Error('Missing Google token');
      const tokens = await post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(config.identityApiKey)}`,
        {
          requestUri: callback,
          postBody: new URLSearchParams({
            id_token: googleTokens['id_token'],
            providerId: 'google.com',
          }).toString(),
          returnSecureToken: true,
        },
      );
      if (typeof tokens['idToken'] !== 'string')
        throw new Error('Missing Identity Platform token');
      const decoded = await auth.verifyIdToken(tokens['idToken'], true);
      if (
        decoded.firebase.sign_in_provider !== 'google.com' ||
        !decoded.email_verified ||
        Math.abs(Date.now() / 1000 - decoded.auth_time) > 300
      )
        throw new Error('A recent verified Google sign-in is required');
      rolesFromClaims(decoded['roles']);
      return auth.createSessionCookie(tokens['idToken'], {
        expiresIn: SESSION_SECONDS * 1000,
      });
    },
    async verifySession(cookie) {
      const decoded = await auth.verifySessionCookie(cookie, true);
      if (
        decoded.firebase.sign_in_provider !== 'google.com' ||
        !decoded.email_verified ||
        !decoded.email
      )
        throw new Error('Verified Google identity required');
      return {
        uid: decoded.uid,
        email: decoded.email,
        roles: rolesFromClaims(decoded['roles']),
      };
    },
    async invocationToken(audience) {
      let pending = clients.get(audience);
      if (!pending) {
        pending = google.getIdTokenClient(audience);
        clients.set(audience, pending);
      }
      try {
        const client = await pending;
        const headers = await client.getRequestHeaders();
        const authorization = headers.get('authorization');
        if (!authorization) throw new Error('Missing invocation token');
        return authorization;
      } catch (error) {
        clients.delete(audience);
        throw error;
      }
    },
  };
}
