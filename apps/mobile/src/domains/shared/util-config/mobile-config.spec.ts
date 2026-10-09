import { resolveMobileConfig } from './mobile-config';

describe('resolveMobileConfig', () => {
  it('uses the configured gateway without a trailing slash', () => {
    expect(
      resolveMobileConfig({
        gatewayUrl: 'https://gateway.example.com/',
        development: false,
      }),
    ).toMatchObject({ gatewayUrl: 'https://gateway.example.com' });
  });

  it('reads the Firebase project only when it is complete', () => {
    const firebase = {
      apiKey: 'key',
      authDomain: 'project.firebaseapp.com',
      projectId: 'project',
    };
    expect(
      resolveMobileConfig({ development: true, firebase }).firebase,
    ).toEqual(firebase);
    expect(
      resolveMobileConfig({
        development: true,
        firebase: { apiKey: 'key' },
      }).firebase,
    ).toBeUndefined();
  });

  it('drops blank Google client ids', () => {
    expect(
      resolveMobileConfig({
        development: true,
        googleClientIds: { ios: ' ', android: 'android-id' },
      }).googleClientIds,
    ).toEqual({ ios: undefined, android: 'android-id', web: undefined });
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
