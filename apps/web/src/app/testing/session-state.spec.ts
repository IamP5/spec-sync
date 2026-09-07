import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthSession } from '../domains/auth/data/auth-session';
import { SessionContext } from '../domains/auth/session/session-context';
import { authInterceptor } from '../domains/auth/transport/auth-interceptor';
import { CHAT_STORAGE_SCOPE } from '../domains/chat/util/storage-scope';
import { WEB_CONFIG } from '../domains/shared/util-config';
import { UserProfileClient } from '../domains/user/data/user-profile-client';
import { PreferencesDetailStore } from '../domains/user/state/preferences-detail-store';
import { USER_STORAGE_SCOPE } from '../domains/user/util/storage-scope';
import { CuratorSessionClient } from '../domains/vehicles/data/curator-session-client';
import { provideFakeAuth } from './fake-auth';
import { testUser } from './fake-user';

function storageScope() {
  const session = inject(SessionContext);
  return () => {
    const scope = session.scope();
    if (!scope) throw new Error('No verified session');
    return scope.uid;
  };
}
const settle = async () => {
  TestBed.tick();
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('account-owned state lifecycle', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        ...provideFakeAuth(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthSession, useValue: { idToken: async () => 'token' } },
        {
          provide: WEB_CONFIG,
          useValue: { gatewayUrl: 'https://gateway.example' },
        },
        { provide: USER_STORAGE_SCOPE, useFactory: storageScope },
        { provide: CHAT_STORAGE_SCOPE, useFactory: storageScope },
      ],
    });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('initializes late consumers from the verified UID and resets each owner synchronously', () => {
    const preferences = TestBed.inject(PreferencesDetailStore);
    const curator = TestBed.inject(CuratorSessionClient);
    preferences.update({ displayName: 'Alice', theme: 'dark' });
    curator.set('private-key');
    const session = TestBed.inject(SessionContext);
    session.invalidate();
    expect(preferences.displayName()).toBe('');
    expect(preferences.theme()).toBe('system');
    expect(curator.key()).toBe('');
    session.establish('bob', session.begin('bob'));
    expect(preferences.displayName()).toBe('');
    preferences.update({ displayName: 'Bob' });
    session.establish('alice', session.begin('alice'));
    expect(preferences.displayName()).toBe('Alice');
    expect(preferences.theme()).toBe('dark');
  });
  it('clears profile/roles immediately, cancels the old request and loads the new account', async () => {
    const profile = TestBed.runInInjectionContext(() =>
      TestBed.inject(UserProfileClient).profileResource(),
    );
    const store = { userValue: profile.value };
    const http = TestBed.inject(HttpTestingController);
    await settle();
    http.expectOne('https://gateway.example/user/me').flush(testUser);
    await settle();
    expect(store.userValue()?.roles).toEqual(['reviewer']);
    const session = TestBed.inject(SessionContext);
    profile.reload();
    await settle();
    const oldRefresh = http.expectOne('https://gateway.example/user/me');
    session.establish('bob', session.begin('bob'));
    expect(oldRefresh.cancelled).toBe(true);
    expect(store.userValue()).toBeUndefined();
    await settle();
    http
      .expectOne('https://gateway.example/user/me')
      .flush({ ...testUser, uid: 'bob', roles: [] });
    await settle();
    expect(store.userValue()?.uid).toBe('bob');
    expect(store.userValue()?.roles).toEqual([]);
  });
});
