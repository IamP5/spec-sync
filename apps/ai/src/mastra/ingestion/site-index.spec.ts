import { afterEach, expect, it, vi } from 'vitest';

const { downloadSource } = vi.hoisted(() => ({ downloadSource: vi.fn() }));
vi.mock('./source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./source')>()),
  downloadSource,
}));

import {
  brandDomains,
  isModelPage,
  sitemapUrls,
  slugOf,
  wellKnownModelPages,
} from './site-index';

const domains = ['ford.com.br', 'toyota.com.br', 'nissan.com.br', 'ram.com.br'];
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
    if (
      value.endsWith('/novo-kicks.html') ||
      value.endsWith('/novo-kicks/compare.html')
    )
      return xml('text/html', '<h1>Kicks</h1>')(value);
    throw new Error(`unexpected ${value}`);
  });
  await expect(
    wellKnownModelPages('Nissan', 'Kicks', signal, domains),
  ).resolves.toEqual([
    {
      url: 'https://www.nissan.com.br/veiculos/modelos/novo-kicks/compare.html',
      html: '<h1>Kicks</h1>',
    },
    {
      url: 'https://www.nissan.com.br/veiculos/modelos/novo-kicks.html',
      html: '<h1>Kicks</h1>',
    },
  ]);
  expect(
    downloadSource.mock.calls.filter(([url]) =>
      url.endsWith('/novo-kicks.html'),
    ),
  ).toHaveLength(1);
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

it('recognizes F150 aliases, deep paths and duplicated RAM model names without matching sibling models', () => {
  expect(
    isModelPage(
      'https://www.ford.com.br/veiculos/novos/picapes/modelos/f150/compare.html',
      'F-150',
      'Ford',
    ),
  ).toBe(true);
  expect(
    isModelPage('https://www.ford.com.br/picapes/f-150/', 'F150', 'Ford'),
  ).toBe(true);
  expect(
    isModelPage('https://www.ford.com.br/picapes/f-1500/', 'F150', 'Ford'),
  ).toBe(false);
  expect(
    isModelPage('https://www.ram.com.br/picapes/1500.html', 'Ram1500', 'RAM'),
  ).toBe(true);
  expect(brandDomains('RAM Trucks', domains)).toEqual(['ram.com.br']);
  expect(brandDomains('RAM', ['ford.com.br'])).toEqual([]);
});

it('validates sitemap leaves and does not cache temporary empty results', async () => {
  downloadSource.mockRejectedValue(new Error('temporary'));
  expect(await sitemapUrls('ford.com.br', signal)).toEqual([]);
  downloadSource.mockImplementation(async (url: string) =>
    url.endsWith('robots.txt')
      ? xml('text/plain', '')(url)
      : xml(
          'application/xml',
          '<urlset><url><loc>https://127.0.0.1/picapes/f-150/</loc></url><url><loc>https://www.ford.com.br/picapes/f-150/</loc></url><url><loc>https://user:pass@www.ford.com.br/picapes/f-150/</loc></url></urlset>',
        )(url),
  );
  expect(await sitemapUrls('ford.com.br', signal)).toEqual([
    'https://www.ford.com.br/picapes/f-150/',
  ]);
});

it('keeps a working official path when the sitemap lists a dead model page', async () => {
  downloadSource.mockImplementation(async (url: string) => {
    if (url.endsWith('robots.txt')) return xml('text/plain', '')(url);
    if (url.endsWith('sitemap.xml'))
      return xml(
        'application/xml',
        '<urlset><url><loc>https://www.ford.com.br/picapes/f-150/dead.html</loc></url></urlset>',
      )(url);
    if (url === 'https://www.ford.com.br/picapes/f-150/')
      return xml('text/html', '<h1>F-150</h1>')(url);
    throw new Error('404');
  });
  expect(await wellKnownModelPages('Ford', 'F150', signal, domains)).toEqual([
    { url: 'https://www.ford.com.br/picapes/f-150/', html: '<h1>F-150</h1>' },
  ]);
});

it('follows an observed model homepage link for a configured manufacturer without path templates', async () => {
  downloadSource.mockImplementation(async (url: string) => {
    if (url === 'https://www.example.com.br/')
      return xml(
        'text/html',
        '<nav><a href="/veiculos/brasil/modelos/truck.html">Truck</a></nav>',
      )(url);
    if (url.endsWith('/truck.html'))
      return xml('text/html', '<h1>Truck</h1>')(url);
    throw new Error('404');
  });
  expect(
    await wellKnownModelPages('Example', 'Truck', signal, ['example.com.br']),
  ).toEqual([
    {
      url: 'https://www.example.com.br/veiculos/brasil/modelos/truck.html',
      html: '<h1>Truck</h1>',
    },
  ]);
});
