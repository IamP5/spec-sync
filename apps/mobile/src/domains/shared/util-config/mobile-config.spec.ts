import { resolveMobileConfig } from './mobile-config';

describe('resolveMobileConfig', () => {
  it('uses the configured gateway without a trailing slash', () => {
    expect(
      resolveMobileConfig({
        gatewayUrl: 'https://gateway.example.com/',
        development: false,
      }),
    ).toEqual({ gatewayUrl: 'https://gateway.example.com' });
  });

  it('falls back to the local gateway in development', () => {
    expect(
      resolveMobileConfig({ os: 'android', development: true }).gatewayUrl,
    ).toBe('http://10.0.2.2:3000');
    expect(
      resolveMobileConfig({ os: 'ios', development: true }).gatewayUrl,
    ).toBe('http://localhost:3000');
  });

  it('requires a gateway URL in release builds', () => {
    expect(() => resolveMobileConfig({ development: false })).toThrow(
      'EXPO_PUBLIC_GATEWAY_URL',
    );
  });

  it('rejects plain http outside local hosts', () => {
    expect(() =>
      resolveMobileConfig({
        gatewayUrl: 'http://gateway.example.com',
        development: false,
      }),
    ).toThrow();
  });
});
