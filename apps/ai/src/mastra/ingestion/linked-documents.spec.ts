import { expect, it } from 'vitest';

import { linkedPdfs } from './linked-documents';

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
