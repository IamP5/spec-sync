import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  createSessionCookie: vi.fn(),
  verifySessionCookie: vi.fn(),
  getRequestHeaders: vi.fn(),
  getIdTokenClient: vi.fn(),
}));
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  applicationDefault: vi.fn(),
}));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => mocks }));
vi.mock('google-auth-library', () => ({
  GoogleAuth: class {
    getIdTokenClient = mocks.getIdTokenClient;
  },
}));

import { createIdentityService } from './identity.js';

const config = {
  publicOrigin: 'https://app.example',
  apiUrl: 'https://api.run.app',
  aiUrl: 'https://ai.run.app',
  webUrl: 'https://web.run.app',
  projectId: 'test',
  googleClientId: 'client',
  googleClientSecret: 'secret',
  identityApiKey: 'api-key',
  cloudRunAuth: true,
};
const claims = {
  uid: 'user',
  email: 'user@example.com',
  email_verified: true,
  auth_time: Math.floor(Date.now() / 1000),
  firebase: { sign_in_provider: 'google.com' },
  roles: ['reviewer'],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  mocks.verifyIdToken.mockResolvedValue(claims);
  mocks.verifySessionCookie.mockResolvedValue(claims);
  mocks.createSessionCookie.mockResolvedValue('cookie');
  mocks.getRequestHeaders.mockResolvedValue(
    new Headers({ authorization: 'Bearer workload' }),
  );
  mocks.getIdTokenClient.mockResolvedValue({
    getRequestHeaders: mocks.getRequestHeaders,
  });
});

describe('Identity Platform adapter', () => {
  it('exchanges Google credentials through Identity Platform before issuing a session', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id_token: 'google-token' }))
      .mockResolvedValueOnce(Response.json({ idToken: 'identity-token' }));
    vi.stubGlobal('fetch', fetcher);
    expect(await createIdentityService(config).signIn('code', 'verifier')).toBe(
      'cookie',
    );
    expect(fetcher.mock.calls[0]![1].body.get('code_verifier')).toBe(
      'verifier',
    );
    expect(fetcher.mock.calls[1]![0]).toContain(
      'identitytoolkit.googleapis.com/v1/accounts:signInWithIdp',
    );
    expect(JSON.parse(fetcher.mock.calls[1]![1].body).postBody).toBe(
      'id_token=google-token&providerId=google.com',
    );
    expect(mocks.verifyIdToken).toHaveBeenCalledWith('identity-token', true);
    expect(mocks.createSessionCookie).toHaveBeenCalledWith('identity-token', {
      expiresIn: 86400000,
    });
  });
  it('checks revocation and uses only verified session claims', async () => {
    expect(await createIdentityService(config).verifySession('cookie')).toEqual(
      { uid: 'user', email: 'user@example.com', roles: ['reviewer'] },
    );
    expect(mocks.verifySessionCookie).toHaveBeenCalledWith('cookie', true);
  });
  it('rejects a different provider, unverified email and malformed roles', async () => {
    for (const value of [
      { ...claims, firebase: { sign_in_provider: 'password' } },
      { ...claims, email_verified: false },
      { ...claims, roles: 'admin' },
    ]) {
      mocks.verifySessionCookie.mockResolvedValue(value);
      await expect(
        createIdentityService(config).verifySession('cookie'),
      ).rejects.toThrow();
    }
  });
  it('rejects stale authentication before creating a session', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ id_token: 'google' }))
        .mockResolvedValueOnce(Response.json({ idToken: 'identity' })),
    );
    mocks.verifyIdToken.mockResolvedValue({ ...claims, auth_time: 1 });
    await expect(
      createIdentityService(config).signIn('code', 'verifier'),
    ).rejects.toThrow('recent');
    expect(mocks.createSessionCookie).not.toHaveBeenCalled();
  });
  it('caches clients per audience while asking the SDK for refreshed headers', async () => {
    const service = createIdentityService(config);
    expect(await service.invocationToken(config.apiUrl)).toBe(
      'Bearer workload',
    );
    await service.invocationToken(config.apiUrl);
    await service.invocationToken(config.aiUrl);
    expect(mocks.getIdTokenClient.mock.calls).toEqual([
      [config.apiUrl],
      [config.aiUrl],
    ]);
    expect(mocks.getRequestHeaders).toHaveBeenCalledTimes(3);
  });
});
