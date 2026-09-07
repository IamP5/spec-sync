import type { RequestContext } from '@mastra/core/request-context';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import type { ContextWithMastra } from '@mastra/core/server';
import {
  type App,
  applicationDefault,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { type Auth, getAuth } from 'firebase-admin/auth';

export const IDENTITY_TOKEN_HEADER = 'x-specsync-token';

export const RESOURCE_PREFIX = 'user:';

const APP_NAME = 'specsync-identity';

const CACHE_LIMIT = 500;

export interface VerifiedUser {
  uid: string;
  resourceId: string;
}

const cache = new Map<string, { user: VerifiedUser; expiresAt: number }>();

let client: Auth | undefined;

export function resourceIdOf(uid: string): string {
  return `${RESOURCE_PREFIX}${uid}`;
}

function identityApp(): App {
  const projectId = process.env['GOOGLE_CLOUD_PROJECT'];
  if (!projectId) {
    throw new Error('Missing GOOGLE_CLOUD_PROJECT');
  }
  return (
    getApps().find((app) => app.name === APP_NAME) ??
    initializeApp({ credential: applicationDefault(), projectId }, APP_NAME)
  );
}

function auth(): Auth {
  client ??= getAuth(identityApp());
  return client;
}

export async function verifyIdentityToken(
  token: string | undefined,
  now: number = Date.now(),
): Promise<VerifiedUser | undefined> {
  if (!token) {
    return undefined;
  }
  const cached = cache.get(token);
  if (cached) {
    if (cached.expiresAt > now) {
      return cached.user;
    }
    cache.delete(token);
  }
  try {
    const decoded = await auth().verifyIdToken(token);
    if (
      decoded.firebase.sign_in_provider !== 'google.com' ||
      !decoded.email_verified ||
      !decoded.uid
    ) {
      return undefined;
    }
    const user: VerifiedUser = {
      uid: decoded.uid,
      resourceId: resourceIdOf(decoded.uid),
    };
    prune(now);
    cache.set(token, { user, expiresAt: decoded.exp * 1000 });
    return user;
  } catch {
    return undefined;
  }
}

export function verifiedUserOf(headers: {
  get(name: string): string | null;
}): Promise<VerifiedUser | undefined> {
  return verifyIdentityToken(headers.get(IDENTITY_TOKEN_HEADER) ?? undefined);
}

export async function setChatIdentityContext(
  c: ContextWithMastra,
  requestContext: RequestContext,
): Promise<void> {
  const user = await verifiedUserOf(c.req.raw.headers);
  if (user) {
    requestContext.set(MASTRA_RESOURCE_ID_KEY, user.resourceId);
  }
}

export async function requireVerifiedUser(
  c: ContextWithMastra,
  next: () => Promise<void>,
): Promise<Response | void> {
  const user = await verifiedUserOf(c.req.raw.headers);
  if (!user) {
    c.header('WWW-Authenticate', 'Bearer');
    return c.json({ error: 'Authentication required' }, 401);
  }
  return next();
}

function prune(now: number): void {
  for (const [token, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(token);
    }
  }
  while (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (oldest.done) {
      return;
    }
    cache.delete(oldest.value);
  }
}
