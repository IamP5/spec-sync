import { afterEach, expect, it, vi } from 'vitest';

const { downloadSource } = vi.hoisted(() => ({ downloadSource: vi.fn() }));
vi.mock('./source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./source')>()),
  downloadSource,
}));

import {
  brandDomains,
  isModelPage,
  slugOf,
  wellKnownModelPages,
} from './site-index';

const domains = ['ford.com.br', 'toyota.com.br', 'nissan.com.br'];
const signal = new AbortController().signal;
const xml = (mime: string, body: string) => (value: string) => ({
  url: new URL(value),
  mime,
  bytes: Buffer.from(body),
});

afterEach(() => downloadSource.mockReset());

it('maps brands to approved domains and models to slugs', () => {
  expect(slugOf('Corolla Cross')).toBe('corolla-cross');
  expect(slugOf('Ranger Raptor 3.0')).toBe('ranger-raptor-3-0');
  expect(brandDomains('Ford', domains)).toEqual(['ford.com.br']);
  expect(brandDomains('Chevrolet', domains)).toEqual([]);
});

it('recognises model pages and rejects support, news and other models', () => {
  expect(isModelPage('https://www.ford.com.br/picapes/ranger/', 'Ranger')).toBe(
    true,
  );
  expect(
    isModelPage(
      'https://www.ford.com.br/picapes/ranger/compare-as-versoes/',
      'Ranger',
    ),
  ).toBe(true);
  expect(
    isModelPage(
      'https://www.nissan.com.br/veiculos/modelos/novo-kicks.html',
      'Kicks',
    ),
  ).toBe(true);
  expect(
    isModelPage('https://www.ford.com.br/picapes/ranger-raptor/', 'Ranger'),
  ).toBe(false);
  expect(
    isModelPage(
      'https://www.ford.com.br/servico-ao-cliente/revisao-ford/ranger/',
      'Ranger',
    ),
  ).toBe(false);
  expect(
    isModelPage(
      'https://www.ford.com.br/support/vehicle/ranger/2026/owner-manuals/',
      'Ranger',
    ),
  ).toBe(false);
  expect(isModelPage('not a url', 'Ranger')).toBe(false);
});

it('reads the sitemap announced by robots.txt, following one index level, and ranks comparison pages first', async () => {
  downloadSource.mockImplementation(async (value: string) => {
    if (value.endsWith('/robots.txt'))
      return xml(
        'text/plain',
        'User-agent: *\nSitemap: https://www.nissan.com.br/index.pages-sitemap.xml\nSitemap: https://www.nissan.com/other.xml\n',
      )(value);
    if (value.endsWith('/index.pages-sitemap.xml'))
      return xml(
        'text/xml',
        '<sitemapindex><sitemap><loc>https://www.nissan.com.br/pages-1.xml</loc></sitemap></sitemapindex>',
      )(value);
    if (value.endsWith('/pages-1.xml'))
      return xml(
        'application/xml',
        [
          '<urlset>',
          '<url><loc>https://www.nissan.com.br/veiculos/modelos/novo-kicks/design.html</loc></url>',
          '<url><loc>https://www.nissan.com.br/veiculos/modelos/novo-kicks.html</loc></url>',
          '<url><loc>https://www.nissan.com.br/veiculos/modelos/novo-kicks/compare.html</loc></url>',
          '<url><loc>https://www.nissan.com.br/central-conhecimento/desempenho-nissan-kicks.html</loc></url>',
          '<url><loc>https://www.nissan.com.br/veiculos/modelos/versa.html</loc></url>',
          '</urlset>',
        ].join(''),
      )(value);
    throw new Error(`unexpected ${value}`);
  });
  await expect(
    wellKnownModelPages('Nissan', 'Kicks', signal, domains),
  ).resolves.toEqual([
    {
      url: 'https://www.nissan.com.br/veiculos/modelos/novo-kicks/compare.html',
    },
    { url: 'https://www.nissan.com.br/veiculos/modelos/novo-kicks.html' },
  ]);
  expect(downloadSource).toHaveBeenCalledTimes(3);
});

it('probes the known path patterns when the site publishes no sitemap', async () => {
  downloadSource.mockImplementation(async (value: string) => {
    if (value === 'https://www.toyota.com.br/modelos/corolla')
      return xml('text/html', '<html>Corolla</html>')(value);
    throw new Error('Source returned HTTP 404.');
  });
  await expect(
    wellKnownModelPages('Toyota', 'Corolla', signal, domains),
  ).resolves.toEqual([
    {
      url: 'https://www.toyota.com.br/modelos/corolla',
      html: '<html>Corolla</html>',
    },
  ]);
});

it('returns nothing for brands without an approved domain', async () => {
  await expect(
    wellKnownModelPages('Chevrolet', 'Onix', signal, domains),
  ).resolves.toEqual([]);
  expect(downloadSource).not.toHaveBeenCalled();
});
