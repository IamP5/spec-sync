import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Events } from '@ngrx/signals/events';
import { ReplaySubject } from 'rxjs';

import { sessionEvents } from '../domains/auth/api/events';
import { AUTH_PROVIDER, AuthSession } from '../domains/auth/data/auth-session';
import { SessionContext } from '../domains/auth/session/session-context';
import { AuthSessionCoordinator } from '../domains/auth/state/auth-session-coordinator';
import { authInterceptor } from '../domains/auth/transport/auth-interceptor';
import { WEB_CONFIG } from '../domains/shared/util-config';

type TestUser = { uid: string; getIdToken: () => Promise<string> };
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('reactive Google session', () => {
  let user$: ReplaySubject<TestUser | null>;
  let sdk: {
    auth: { currentUser: TestUser | null; authStateReady: () => Promise<void> };
    user$: ReplaySubject<TestUser | null>;
    login: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let context: SessionContext;
  let http: HttpTestingController;
  const reload = vi.fn();
  beforeEach(() => {
    user$ = new ReplaySubject(1);
    sdk = {
      user$,
      auth: { currentUser: null, authStateReady: async () => undefined },
      login: vi.fn(async () => undefined),
      logout: vi.fn(async () => {
        sdk.auth.currentUser = null;
        user$.next(null);
      }),
    };
    vi.stubGlobal('location', { reload });
    reload.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTH_PROVIDER, useValue: sdk },
        {
          provide: WEB_CONFIG,
          useValue: { gatewayUrl: 'https://gateway.example' },
        },
      ],
    });
    context = TestBed.inject(SessionContext);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthSessionCoordinator);
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });
  async function emit(uid: string | null, token = 'token') {
    sdk.auth.currentUser = uid ? { uid, getIdToken: async () => token } : null;
    user$.next(sdk.auth.currentUser);
    await settle();
  }
  async function verify(uid: string) {
    http.expectOne('https://gateway.example/auth/session').flush({ uid });
    await settle();
  }

  it('distinguishes restoration from signed out and verifies before enabling a session', async () => {
    expect(context.snapshot().status).toBe('restoring');
    await emit(null);
    expect(context.snapshot().status).toBe('signed-out');
    await emit('alice');
    expect(context.authenticated()).toBe(false);
    await verify('alice');
    expect(context.scope()?.uid).toBe('alice');
  });
  it('refreshes credentials without resetting an established account', async () => {
    await emit('alice');
    await verify('alice');
    const scope = context.scope();
    const reset = vi.fn();
    const subscription = TestBed.inject(Events)
      .on(sessionEvents.invalidated)
      .subscribe(reset);
    await emit('alice', 'refreshed');
    const request = http.expectOne('https://gateway.example/auth/session');
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer refreshed',
    );
    request.flush({ uid: 'alice' });
    expect(context.scope()).toBe(scope);
    expect(reset).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });
  it('cancels verification for the old account and never establishes it for a new user', async () => {
    await emit('alice');
    const alice = http.expectOne('https://gateway.example/auth/session');
    await emit('bob');
    expect(alice.cancelled).toBe(true);
    await verify('bob');
    expect(context.scope()?.uid).toBe('bob');
  });
  it('invalidates a rejected session and can recover on the next SDK event', async () => {
    await emit('alice');
    http
      .expectOne('https://gateway.example/auth/session')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(context.snapshot().status).toBe('error');
    await emit('alice');
    await verify('alice');
    expect(context.authenticated()).toBe(true);
  });
  it('signs in and out without reloading, clearing the verified snapshot on sign-out', async () => {
    await TestBed.inject(AuthSession).login();
    await emit('alice');
    await verify('alice');
    TestBed.inject(AuthSessionCoordinator).logout();
    await settle();
    expect(sdk.logout).toHaveBeenCalledOnce();
    expect(context.authenticated()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
  it('disposes SDK subscriptions when the application injector is destroyed', () => {
    expect(user$.observed).toBe(true);
    TestBed.resetTestingModule();
    expect(user$.observed).toBe(false);
  });
});
