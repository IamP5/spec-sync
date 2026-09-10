import { parse } from 'parse5';
import { describe, expect, it } from 'vitest';

import { embeddedHtmlContent } from './html-content';

function attribute(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;');
}

describe('embedded manufacturer HTML content', () => {
  it('preserves declared versions, their year and separate marketing scope without assigning shared claims to trims', () => {
    const text = embeddedHtmlContent(
      parse(`
      <prox-master-versions general-heading-text="Explore &amp; compare" versions-param-year="2026"
        versions-data="${attribute([
          {
            modelName: 'Atlas',
            versionName: 'Base',
            year: '2026',
            engine: '2.0',
            featurePremiumLeft: 'Payload 800 kg',
          },
          {
            modelName: 'Atlas',
            versionName: 'Sport',
            year: '2026',
            engine: '3.0',
            featurePremiumLeft: 'Payload 700 kg',
          },
        ])}"></prox-master-versions>
      <prox-master-all-features all-features-title="Performance"
        items="${attribute([{ title: 'Model highlights', slides: [{ title: 'Power', text: 'Up to 321 hp; selected engine only.' }] }])}"></prox-master-all-features>
    `),
    );
    expect(text).toContain('general-heading-text: Explore & compare');
    expect(text).toContain('versions-param-year: 2026');
    expect(text).toContain('versions-data[0].versionName: Base');
    expect(text).toContain('versions-data[1].versionName: Sport');
    expect(text).toContain(
      'versions-data[0].featurePremiumLeft: Payload 800 kg',
    );
    expect(text).toContain(
      'versions-data[1].featurePremiumLeft: Payload 700 kg',
    );
    expect(text).toContain('each indexed record has its own scope');
    expect(text).toContain(
      'applicability to individual versions is not established',
    );
    expect(text).toContain(
      'items[0].slides[0].text: Up to 321 hp; selected engine only.',
    );
    expect(text.match(/321 hp/g)).toHaveLength(1);
    expect(text.indexOf('321 hp')).toBeGreaterThan(text.indexOf('section 2'));
  });

  it('decodes rich content safely and preserves table cells, headings and qualifiers', () => {
    const text = embeddedHtmlContent(
      parse(
        `<vehicle-specifications items="${attribute([
          {
            title: 'Dimensions',
            text: '<h2>Body &amp; load</h2><table><tr><th>Trim</th><th>Weight</th></tr><tr><td>Base</td><td>1900 kg*</td></tr></table><p>* without optional equipment</p><script>forbiddenScript()</script>',
          },
          {
            title: 'Comparison',
            headers: ['Trim', 'Fuel'],
            rows: [
              ['Base', 'Flex'],
              ['Sport', 'Diesel'],
            ],
          },
        ])}"></vehicle-specifications>`,
      ),
    );
    expect(text).toContain('Body & load');
    expect(text).toContain('Trim | Weight |');
    expect(text).toContain('Base | 1900 kg* |');
    expect(text).toContain('* without optional equipment');
    expect(text).toContain('items[1].headers[0]: Trim');
    expect(text).toContain('items[1].rows[1][1]: Diesel');
    expect(text).not.toContain('forbiddenScript');
  });

  it('omits navigation, footer years, forms, settings, secrets and media URLs', () => {
    const text = embeddedHtmlContent(
      parse(`
      <hub-header><vehicle-versions versions-data="${attribute([{ versionName: 'Navigation bait' }])}"></vehicle-versions></hub-header>
      <footer><vehicle-versions versions-param-year="2099"></vehicle-versions></footer>
      <unrelated-widget items="${attribute([{ title: 'Unrelated application state' }])}"></unrelated-widget>
      <vehicle-features secret-key-form="fake-secret" client-id-form="fake-account" button-text="Buy now"
        config="${attribute({ title: 'Configuration bait' })}"
        items="${attribute([{ title: 'Useful equipment', secretKey: 'nested-secret', style: 'red', src: 'https://example.test/media.jpg', text: 'https://example.test/only-url', copyrightText: 'Copyright 2098' }])}"></vehicle-features>
      <next-gen-rich-text text="Copyright 2097 Example"></next-gen-rich-text>
    `),
    );
    expect(text).toContain('Useful equipment');
    for (const excluded of [
      'Navigation bait',
      '2099',
      'Unrelated application',
      'fake-secret',
      'fake-account',
      'Buy now',
      'Configuration bait',
      'nested-secret',
      'red',
      'example.test',
      '2098',
      '2097',
    ])
      expect(text).not.toContain(excluded);
  });

  it('accepts explicit content attributes while rejecting executable bindings and prototype keys', () => {
    const text = embeddedHtmlContent(
      parse(`
      <section data-versions="${attribute([{ versionName: 'Declared trim' }])}"></section>
      <vehicle-features :items="globalThis.untrustedExecuted = true" @click="throw Error('executed')"></vehicle-features>
      <vehicle-features items="{&quot;__proto__&quot;:{&quot;title&quot;:&quot;Prototype bait&quot;},&quot;constructor&quot;:{&quot;title&quot;:&quot;Constructor bait&quot;},&quot;title&quot;:&quot;Safe heading&quot;}"></vehicle-features>
      <next-gen-rich-text :text="&quot;A declared JSON string&quot;"></next-gen-rich-text>
    `),
    );
    expect(text).toContain('Declared trim');
    expect(text).toContain('Safe heading');
    expect(text).toContain('A declared JSON string');
    expect(text).not.toMatch(
      /Prototype bait|Constructor bait|untrustedExecuted|executed/,
    );
    expect(Object.hasOwn(globalThis, 'untrustedExecuted')).toBe(false);
    expect(Object.hasOwn(Object.prototype, 'title')).toBe(false);
  });

  it('bounds nested objects, long attributes, record counts and DOM depth', () => {
    let nested: unknown = { title: 'Too deep' };
    for (let i = 0; i < 20; i++) nested = { items: nested };
    const text = embeddedHtmlContent(
      parse(`
      <vehicle-features items="${attribute(nested)}"></vehicle-features>
      <vehicle-versions versions-data="${attribute(Array.from({ length: 100 }, (_, i) => ({ versionName: `Trim-${i}` })))}"></vehicle-versions>
      <vehicle-features items="${attribute([{ text: 'x'.repeat(130_000) }])}"></vehicle-features>
      ${'<div>'.repeat(60)}<vehicle-features title="Too deeply nested DOM"></vehicle-features>${'</div>'.repeat(60)}
    `),
    );
    expect(text).toContain('Trim-79');
    expect(text).not.toContain('Trim-80');
    expect(text).not.toContain('Too deep');
    expect(text).not.toContain('Too deeply nested DOM');
    expect(text).not.toContain('x'.repeat(100));
    expect(text).toContain('truncated at bounded extraction limits');
    expect(text.length).toBeLessThan(80_100);
  });
});
