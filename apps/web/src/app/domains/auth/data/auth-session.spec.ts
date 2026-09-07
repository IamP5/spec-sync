import { TestBed } from '@angular/core/testing';

import { AUTH_PROVIDER, AuthSession } from './auth-session';

const sdk = vi.hoisted(() => ({
  auth: {
    currentUser: null as {
      uid: string;
      getIdToken: () => Promise<string>;
    } | null,
    authStateReady: vi.fn<() => Promise<void>>(),
  },
  listen: vi.fn(),
  unsubscribe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));
describe('auth SDK session lifecycle', () => {
  let listener: (user: typeof sdk.auth.currentUser) => Promise<void>;
  const reload = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.auth.currentUser = null;
    sdk.auth.authStateReady.mockResolvedValue();
    sdk.login.mockResolvedValue(undefined);
    sdk.logout.mockResolvedValue(undefined);
    sdk.listen.mockImplementation((callback) => {
      listener = callback;
      return sdk.unsubscribe;
    });
    vi.stubGlobal('location', { reload });
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AUTH_PROVIDER,
          useValue: {
            auth: sdk.auth,
            login: sdk.login,
            logout: sdk.logout,
            onTokenChanged: sdk.listen,
          },
        },
      ],
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });
  it('waits for restoration, tracks token refresh and disposes the listener', async () => {
    const session = TestBed.inject(AuthSession);
    expect(session.ready()).toBe(false);
    await listener(null);
    expect(session.ready()).toBe(true);
    expect(session.token()).toBeNull();
    const getIdToken = vi.fn().mockResolvedValue('first');
    sdk.auth.currentUser = { uid: 'alice', getIdToken };
    await listener(sdk.auth.currentUser);
    expect(session.token()).toBe('first');
    getIdToken.mockResolvedValue('refreshed');
    expect(await session.idToken()).toBe('refreshed');
    TestBed.resetTestingModule();
    expect(sdk.unsubscribe).toHaveBeenCalledOnce();
  });
  it('rejects requests before sign-in', async () => {
    await expect(TestBed.inject(AuthSession).idToken()).rejects.toThrow(
      'Sign in',
    );
  });
  it('discards application state after successful login and logout', async () => {
    const session = TestBed.inject(AuthSession);
    await session.login();
    expect(sdk.login).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledTimes(1);
    await session.logout();
    expect(sdk.logout).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledTimes(2);
  });
  it('keeps a failed logout visible instead of reloading', async () => {
    sdk.logout.mockRejectedValueOnce(new Error('Failed to sign out'));
    await expect(TestBed.inject(AuthSession).logout()).rejects.toThrow(
      'Failed to sign out',
    );
    expect(reload).not.toHaveBeenCalled();
  });
});
