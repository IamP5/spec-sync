import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { AuthSession, WEB_CONFIG } from './domains/auth/data/auth-session';
import { gatewayInterceptor } from './gateway-interceptor';

describe('gateway credentials', () => {
  const idToken = vi.fn<() => Promise<string>>();
  beforeEach(() => {
    idToken.mockReset().mockResolvedValue('fresh-token');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([gatewayInterceptor])),
        provideHttpClientTesting(),
        {
          provide: WEB_CONFIG,
          useValue: { gatewayUrl: 'https://gateway.example' },
        },
        { provide: AuthSession, useValue: { idToken } },
      ],
    });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('gets a current token for each API request and preserves curator headers', async () => {
    const http = TestBed.inject(HttpClient);
    const testing = TestBed.inject(HttpTestingController);
    for (const token of ['first', 'refreshed']) {
      idToken.mockResolvedValueOnce(token);
      const result = firstValueFrom(
        http.post(
          '/api/ingestions',
          {},
          { headers: { 'X-Ingestion-Key': 'curator' } },
        ),
      );
      await Promise.resolve();
      const request = testing.expectOne(
        'https://gateway.example/api/ingestions',
      );
      expect(request.request.headers.get('Authorization')).toBe(
        `Bearer ${token}`,
      );
      expect(request.request.headers.get('X-Ingestion-Key')).toBe('curator');
      expect(request.request.credentials).toBe('omit');
      expect(request.request.redirect).toBe('error');
      request.flush({ ok: true });
      await result;
    }
  });
  it('authenticates the separate session and user endpoints', async () => {
    for (const path of ['/auth/session', '/user/me']) {
      const result = firstValueFrom(TestBed.inject(HttpClient).get(path));
      await Promise.resolve();
      const request = TestBed.inject(HttpTestingController).expectOne(
        `https://gateway.example${path}`,
      );
      expect(request.request.headers.get('Authorization')).toBe(
        'Bearer fresh-token',
      );
      request.flush({});
      await result;
    }
  });
  it('never attaches credentials to external, protocol-relative or lookalike URLs', async () => {
    for (const url of [
      'https://other.example/api/data',
      '//other.example/api/data',
      '/api-evil',
      '/assets/logo.svg',
    ]) {
      const result = firstValueFrom(TestBed.inject(HttpClient).get(url));
      const request = TestBed.inject(HttpTestingController).expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
      await result;
    }
    expect(idToken).not.toHaveBeenCalled();
  });
  it('does not send a request if the session cannot provide a token', async () => {
    idToken.mockRejectedValueOnce(new Error('Sign in to continue.'));
    await expect(
      firstValueFrom(TestBed.inject(HttpClient).get('/auth/session')),
    ).rejects.toThrow('Sign in');
    TestBed.inject(HttpTestingController).expectNone(
      'https://gateway.example/auth/session',
    );
  });
});
