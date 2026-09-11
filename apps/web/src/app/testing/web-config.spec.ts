import { resolveWebConfig } from '../domains/shared/util-config';

const firebase = {
  apiKey: 'public-browser-key',
  authDomain: 'example.firebaseapp.com',
  projectId: 'example',
};

describe('runtime gateway configuration', () => {
  it.each([
    'https://macbook-pro.taila2e389.ts.net:8443',
    'http://localhost:4200',
  ])('resolves proxied calls on the browsing device origin %s', (origin) => {
    const config = resolveWebConfig(
      { gatewayUrl: 'same-origin', firebase },
      origin,
    );
    expect(config.gatewayUrl + '/auth/session').toBe(origin + '/auth/session');
    expect(config.gatewayUrl + '/ai/copilotkit').toBe(
      origin + '/ai/copilotkit',
    );
  });
  it('preserves an explicitly configured production gateway', () => {
    expect(
      resolveWebConfig(
        { gatewayUrl: 'https://gateway.example', firebase },
        'https://web.example',
      ).gatewayUrl,
    ).toBe('https://gateway.example');
  });
  it.each([
    'https://user:password@example.com',
    'https://example.com/path',
    'https://example.com?token=x',
    'http://example.com',
    'null',
    '//example.com',
  ])('rejects an unsafe gateway or application origin %s', (origin) => {
    expect(() =>
      resolveWebConfig({ gatewayUrl: origin, firebase }, 'https://web.example'),
    ).toThrow();
    expect(() =>
      resolveWebConfig({ gatewayUrl: 'same-origin', firebase }, origin),
    ).toThrow();
  });
});
