import { expect, it } from 'vitest';

import { linkedPdfs, linkedSpecificationPages } from './linked-documents';

const base = 'https://www.ford.com.br/picapes/ranger/compare-as-versoes/';

it('lists PDFs on approved domains from markup and embedded JSON, brochures first', () => {
  const html = [
    '<a href="/content/dam/br/pdf/fbr-ranger-manual-de-implementador.pdf">Manual</a>',
    '{"file":"\\/content\\/dam\\/br\\/pdf\\/fbr-ranger-ficha-tecnica.pdf?v=2#p1"}',
    "<a href='https://www.ford.com.br/content/dam/br/pdf/fbr-ranger-ebook.pdf'>E-book</a>",
    '<a href="https://www.ford.com.br/content/dam/br/pdf/fbr-ranger-ficha-tecnica.pdf?v=2">again</a>',
    '<a href="https://cdn.example.com/other-ficha-tecnica.pdf">elsewhere</a>',
    'url(../catalogo-ranger.PDF)',
  ].join('\n');
  expect(linkedPdfs(html, base, ['ford.com.br'])).toEqual([
    {
      title: 'fbr-ranger-ficha-tecnica.pdf',
      url: 'https://www.ford.com.br/content/dam/br/pdf/fbr-ranger-ficha-tecnica.pdf?v=2',
      specification: true,
    },
    {
      title: 'catalogo-ranger.PDF',
      url: 'https://www.ford.com.br/picapes/ranger/catalogo-ranger.PDF',
      specification: true,
    },
    {
      title: 'Manual',
      url: 'https://www.ford.com.br/content/dam/br/pdf/fbr-ranger-manual-de-implementador.pdf',
      specification: false,
    },
    {
      title: 'E-book',
      url: 'https://www.ford.com.br/content/dam/br/pdf/fbr-ranger-ebook.pdf',
      specification: false,
    },
  ]);
});

it('uses link labels when the file names carry no meaning', () => {
  const html = [
    '<a href="https://media.toyota.com.br/7748a09d.pdf" data-x="1"><span>Tabela de preços</span></a>',
    '<h3><a href="https://media.toyota.com.br/5c3dfe71.pdf" target="_blank">Catálogo</a></h3>',
    '{"label":"Tabela de ruídos","target":{"url":"https://media.toyota.com.br/f5da9285.pdf"}}',
    '{"title":"Manual do proprietário","link":"https://media.toyota.com.br/aaaa.pdf"}',
  ].join('');
  expect(
    linkedPdfs(html, 'https://www.toyota.com.br/modelos/corolla', [
      'toyota.com.br',
    ]),
  ).toEqual([
    {
      title: 'Catálogo',
      url: 'https://media.toyota.com.br/5c3dfe71.pdf',
      specification: true,
    },
    {
      title: 'Tabela de preços',
      url: 'https://media.toyota.com.br/7748a09d.pdf',
      specification: false,
    },
    {
      title: 'Tabela de ruídos',
      url: 'https://media.toyota.com.br/f5da9285.pdf',
      specification: false,
    },
    {
      title: 'Manual do proprietário',
      url: 'https://media.toyota.com.br/aaaa.pdf',
      specification: false,
    },
  ]);
});

it('returns nothing for pages without PDF references', () => {
  expect(linkedPdfs('<p>no documents</p>', base, ['ford.com.br'])).toEqual([]);
});

it('reads entity-encoded component JSON while excluding footer and rescue documents from specification ranking', () => {
  const html =
    '<prox-master-links data-links="[{&#34;label&#34;:&#34;Catálogo&#34;,&#34;url&#34;:&#34;\\u002fdocs\\u002fcatalogo-1500.pdf&#34;}]"></prox-master-links><prox-common-footer data-links="[{&#34;url&#34;:&#34;/docs/ficha-global.pdf&#34;}]"></prox-common-footer><a href="/docs/ficha-de-resgate.pdf">Ficha de resgate</a>';
  expect(
    linkedPdfs(html, 'https://www.ram.com.br/picapes/1500.html', [
      'ram.com.br',
    ]),
  ).toEqual([
    {
      title: 'Catálogo',
      url: 'https://www.ram.com.br/docs/catalogo-1500.pdf',
      specification: true,
    },
    {
      title: 'Ficha de resgate',
      url: 'https://www.ram.com.br/docs/ficha-de-resgate.pdf',
      specification: false,
    },
  ]);
});

it('follows only relevant observed official page links outside navigation', () => {
  expect(
    linkedSpecificationPages(
      '<nav><a href="/ranger/other.html">Ranger</a></nav><a href="/ficha.html">Ficha técnica</a><a href="https://ford.com.br.evil.test/ranger.html">Ranger</a><a href="/news/ranger.html">Ranger notícia</a>',
      base,
      'Ranger',
      'Ford',
      ['ford.com.br'],
    ),
  ).toEqual([
    { title: 'Ficha técnica', url: 'https://www.ford.com.br/ficha.html' },
  ]);
});
