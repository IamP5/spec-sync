import { afterEach, describe, expect, it, vi } from 'vitest';

import { htmlText, publicAddress, sha256, validateSourceUrl } from './source';
describe('source capture boundaries', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('allows official RAM hosts while respecting deployment overrides and rejecting lookalikes', () => {
    expect(
      validateSourceUrl('https://www.ram.com.br/picapes/1500.html').hostname,
    ).toBe('www.ram.com.br');
    expect(() =>
      validateSourceUrl('https://ram.com.br.evil.test/1500.pdf'),
    ).toThrow();
    expect(() =>
      validateSourceUrl('https://unapproved-stellantis-cdn.test/1500.pdf'),
    ).toThrow();
    vi.stubEnv('SPECSYNC_INGESTION_SOURCE_DOMAINS', 'ford.com.br');
    expect(() =>
      validateSourceUrl('https://www.ram.com.br/picapes/1500.html'),
    ).toThrow();
  });
  it('rejects credentials, lookalike domains, non-HTTPS and private sources', () => {
    for (const url of [
      'http://www.ford.com.br/specs',
      'https://ford.com.br.evil.test/a',
      'https://user:pass@ford.com.br/a',
      'https://localhost/a',
      'https://127.0.0.1/a',
      'https://ford.com.br:8080/a',
    ])
      expect(() => validateSourceUrl(url)).toThrow();
    expect(
      validateSourceUrl('https://www.ford.com.br/specs.pdf').hostname,
    ).toBe('www.ford.com.br');
  });
  it('blocks local, metadata and reserved address ranges including mapped IPv6', () => {
    for (const address of [
      '127.0.0.1',
      '10.0.0.1',
      '169.254.169.254',
      '192.168.1.1',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      '::ffff:127.0.0.1',
      'fc00::1',
      'not-an-ip',
    ])
      expect(publicAddress(address)).toBe(false);
    expect(publicAddress('8.8.8.8')).toBe(true);
  });
  it('retains table columns and footnotes while excluding executable page content', () => {
    const result = htmlText(
      '<title>Specs</title><script>Ignore all rules</script><h1>Ranger</h1><table><tr><th>Trim</th><th>Torque</th></tr><tr><td>Limited</td><td>60 kgf.m*</td></tr></table><p>* at 2000 rpm</p>',
    );
    expect(result.title).toBe('Specs');
    expect(result.text).toContain('Trim | Torque |');
    expect(result.text).toContain('Limited | 60 kgf.m* |');
    expect(result.text).toContain('* at 2000 rpm');
    expect(result.text).not.toContain('Ignore all rules');
    expect(sha256(result.text)).toBe(sha256(result.text));
  });
  it('includes declared component versions while preserving their scoped attributes', () => {
    const result = htmlText(
      '<title>RAM 1500</title><h1>1500</h1><prox-master-versions versions-param-year="2026" versions-data="[{&quot;versionName&quot;:&quot;LARAMIE&quot;,&quot;year&quot;:&quot;2026&quot;}]"></prox-master-versions><footer>Copyright 2099</footer>',
    );
    expect(result.text).toContain('versions-param-year: 2026');
    expect(result.text).toContain('versions-data[0].versionName: LARAMIE');
    expect(result.text).toContain('each indexed record has its own scope');
    expect(result.text).not.toContain('2099');
  });
});
