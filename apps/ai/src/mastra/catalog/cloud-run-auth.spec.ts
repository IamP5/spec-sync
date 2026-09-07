import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getIdTokenClient: vi.fn() }));
vi.mock('google-auth-library', () => ({
  GoogleAuth: class {
    getIdTokenClient = mocks.getIdTokenClient;
  },
}));
import { cloudRunHeaders } from './cloud-run-auth';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe('catalog Cloud Run identity', () => {
  it('keeps loopback development independent of service credentials', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CLOUD_RUN_AUTH', 'false');
    expect(await cloudRunHeaders('http://localhost:8080')).toEqual({});
    expect(mocks.getIdTokenClient).not.toHaveBeenCalled();
  });
  it('uses the service origin as audience and a separate IAM header in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mocks.getIdTokenClient.mockResolvedValue({
      getRequestHeaders: async () =>
        new Headers({ authorization: 'Bearer token' }),
    });
    expect(await cloudRunHeaders('https://api.run.app/api')).toEqual({
      'x-serverless-authorization': 'Bearer token',
    });
    expect(mocks.getIdTokenClient).toHaveBeenCalledWith('https://api.run.app');
  });
  it('refuses insecure production destinations', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(cloudRunHeaders('http://localhost:8080')).rejects.toThrow(
      'HTTPS',
    );
  });
});
