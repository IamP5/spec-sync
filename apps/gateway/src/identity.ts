import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { GoogleAuth } from 'google-auth-library';

import type { GatewayConfig } from './config.js';

export interface UserIdentity {
  uid: string;
  email: string;
  roles: string[];
  displayName: string;
  photoUrl: string | null;
}
export interface IdentityService {
  verifyToken(token: string): Promise<UserIdentity>;
  invocationToken(audience: string): Promise<string>;
}

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
  return {
    async verifyToken(token) {
      const decoded = await auth.verifyIdToken(token, true);
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
        displayName:
          typeof decoded.name === 'string' ? decoded.name : decoded.email,
        photoUrl:
          typeof decoded.picture === 'string' &&
          decoded.picture.startsWith('https://')
            ? decoded.picture
            : null,
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
