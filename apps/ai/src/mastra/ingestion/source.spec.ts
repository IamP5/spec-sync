import { describe, expect, it } from 'vitest';

import { htmlText, publicAddress, sha256, validateSourceUrl } from './source';
describe('source capture boundaries', () => {
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
});
