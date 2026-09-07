import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyIdToken = vi.fn();

vi.mock('firebase-admin/app', () => ({
  applicationDefault: () => ({}),
  getApps: () => [],
  initializeApp: () => ({ name: 'specsync-identity' }),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifyIdToken }),
}));

const {
  IDENTITY_TOKEN_HEADER,
  requireVerifiedUser,
  resourceIdOf,
  verifiedUserOf,
  verifyIdentityToken,
} = await import('./identity');

const NOW = 1_700_000_000_000;

function googleToken(uid: string, exp = NOW / 1000 + 3600) {
  return {
    uid,
    exp,
    email_verified: true,
    firebase: { sign_in_provider: 'google.com' },
  };
}

describe('identity', () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    process.env['GOOGLE_CLOUD_PROJECT'] = 'test-project';
  });

  it('scopes memory to the verified user', () => {
    expect(resourceIdOf('abc')).toBe('user:abc');
  });

  it('rejects a missing token without calling the verifier', async () => {
    await expect(verifyIdentityToken(undefined, NOW)).resolves.toBeUndefined();
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('accepts a verified Google token', async () => {
    verifyIdToken.mockResolvedValue(googleToken('u-1'));
    await expect(verifyIdentityToken('token-1', NOW)).resolves.toEqual({
      uid: 'u-1',
      resourceId: 'user:u-1',
    });
  });

  it('rejects another sign-in provider', async () => {
    verifyIdToken.mockResolvedValue({
      ...googleToken('u-2'),
      firebase: { sign_in_provider: 'password' },
    });
    await expect(verifyIdentityToken('token-2', NOW)).resolves.toBeUndefined();
  });

  it('rejects an unverified email', async () => {
    verifyIdToken.mockResolvedValue({
      ...googleToken('u-3'),
      email_verified: false,
    });
    await expect(verifyIdentityToken('token-3', NOW)).resolves.toBeUndefined();
  });

  it('rejects a token the verifier refuses', async () => {
    verifyIdToken.mockRejectedValue(new Error('expired'));
    await expect(verifyIdentityToken('token-4', NOW)).resolves.toBeUndefined();
  });

  it('verifies a token once while it is valid', async () => {
    verifyIdToken.mockResolvedValue(googleToken('u-5'));
    await verifyIdentityToken('token-5', NOW);
    await verifyIdentityToken('token-5', NOW + 1000);
    expect(verifyIdToken).toHaveBeenCalledTimes(1);
  });

  it('verifies again once the cached token expired', async () => {
    verifyIdToken.mockResolvedValue(googleToken('u-6', NOW / 1000 + 60));
    await verifyIdentityToken('token-6', NOW);
    await verifyIdentityToken('token-6', NOW + 120_000);
    expect(verifyIdToken).toHaveBeenCalledTimes(2);
  });

  it('reads the token from the gateway header', async () => {
    verifyIdToken.mockResolvedValue(googleToken('u-7'));
    const headers = new Headers({ [IDENTITY_TOKEN_HEADER]: 'token-7' });
    await expect(verifiedUserOf(headers)).resolves.toEqual({
      uid: 'u-7',
      resourceId: 'user:u-7',
    });
  });

  it('answers 401 when no user was verified', async () => {
    verifyIdToken.mockRejectedValue(new Error('nope'));
    const next = vi.fn();
    const response = await requireVerifiedUser(
      context(new Headers({ [IDENTITY_TOKEN_HEADER]: 'bad' })),
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(401);
  });

  it('continues once a user was verified', async () => {
    verifyIdToken.mockResolvedValue(googleToken('u-8'));
    const next = vi.fn().mockResolvedValue(undefined);
    await requireVerifiedUser(
      context(new Headers({ [IDENTITY_TOKEN_HEADER]: 'token-8' })),
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});

function context(headers: Headers) {
  return {
    req: { raw: { headers } },
    header: () => undefined,
    json: (body: unknown, status: number) =>
      new Response(JSON.stringify(body), { status }),
  } as never;
}
