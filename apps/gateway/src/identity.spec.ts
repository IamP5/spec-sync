import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
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
  frontendOrigin: 'https://web.run.app',
  projectId: 'test',
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
  mocks.verifyIdToken.mockResolvedValue(claims);
  mocks.getRequestHeaders.mockResolvedValue(
    new Headers({ authorization: 'Bearer workload' }),
  );
  mocks.getIdTokenClient.mockResolvedValue({
    getRequestHeaders: mocks.getRequestHeaders,
  });
});

describe('Identity Platform adapter', () => {
  it('checks revocation and uses only verified session claims', async () => {
    expect(await createIdentityService(config).verifyToken('cookie')).toEqual({
      uid: 'user',
      email: 'user@example.com',
      roles: ['reviewer'],
      displayName: 'user@example.com',
      photoUrl: null,
    });
    expect(mocks.verifyIdToken).toHaveBeenCalledWith('cookie', true);
  });
  it('rejects a different provider, unverified email and malformed roles', async () => {
    for (const value of [
      { ...claims, firebase: { sign_in_provider: 'password' } },
      { ...claims, email_verified: false },
      { ...claims, roles: 'admin' },
    ]) {
      mocks.verifyIdToken.mockResolvedValue(value);
      await expect(
        createIdentityService(config).verifyToken('cookie'),
      ).rejects.toThrow();
    }
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
