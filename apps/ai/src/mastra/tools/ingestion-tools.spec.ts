import { noopObserve } from '@mastra/core/tools';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('@mastra/core/agent', () => ({
  Agent: class {
    generate = generate;
  },
}));

const { downloadSource, wellKnownModelPages } = vi.hoisted(() => ({
  downloadSource: vi.fn(),
  wellKnownModelPages: vi.fn(),
}));
vi.mock('../ingestion/source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ingestion/source')>()),
  downloadSource,
}));
vi.mock('../ingestion/site-index', () => ({ wellKnownModelPages }));

import { discoverVehicleSpecificationSources } from './ingestion-tools';

const redirect = (id: string) =>
  `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${id}`;
const context = {
  observe: noopObserve,
  abortSignal: new AbortController().signal,
};

afterEach(() => {
  vi.unstubAllGlobals();
  generate.mockReset();
  downloadSource.mockReset();
  wellKnownModelPages.mockReset();
});
beforeEach(() => wellKnownModelPages.mockResolvedValue([]));

it('resolves grounding redirects, keeps approved pages and lists the brochures they link', async () => {
  generate.mockResolvedValue({
    text: 'Veja o site oficial.',
    sources: [
      {
        payload: {
          sourceType: 'url',
          title: 'mercadolivre.com.br',
          url: redirect('ml'),
        },
      },
      {
        payload: {
          sourceType: 'url',
          title: 'ford.com.br',
          url: redirect('ford'),
        },
      },
      {
        payload: {
          sourceType: 'url',
          title: 'ford.com.br',
          url: redirect('ford-dup'),
        },
      },
      {
        payload: {
          sourceType: 'url',
          title: 'ford.com.br',
          url: redirect('pdf'),
        },
      },
    ],
  });
  const locations: Record<string, string> = {
    ml: 'https://www.mercadolivre.com.br/ranger',
    ford: 'https://www.ford.com.br/picapes/ranger/compare-as-versoes/',
    'ford-dup': 'https://www.ford.com.br/picapes/ranger/compare-as-versoes/',
    pdf: 'https://www.ford.com.br/content/dam/ficha-tecnica.pdf',
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const location = locations[url.split('/').pop() ?? ''];
      return new Response(null, {
        status: location ? 302 : 404,
        headers: location ? { location } : {},
      });
    }),
  );
  downloadSource.mockImplementation(async (value: string) => ({
    url: new URL(value),
    mime: 'text/html',
    bytes: Buffer.from(
      '<a href="/content/dam/ranger/fbr-ranger-ebook.pdf">E-book</a><a href="/content/dam/ranger/fbr-ranger-ficha-tecnica.pdf">Ficha técnica</a>',
    ),
  }));
  const result = await discoverVehicleSpecificationSources.execute?.(
    { brand: 'Ford', model: 'Ranger', modelYear: 2026 },
    context,
  );
  expect(result).toMatchObject({
    status: 'OK',
    items: [
      {
        title: 'Ficha técnica',
        url: 'https://www.ford.com.br/content/dam/ranger/fbr-ranger-ficha-tecnica.pdf',
        documentType: 'PDF',
      },
      {
        title: 'E-book',
        url: 'https://www.ford.com.br/content/dam/ranger/fbr-ranger-ebook.pdf',
        documentType: 'PDF',
      },
      {
        title: 'ford.com.br/picapes/ranger/compare-as-versoes',
        url: 'https://www.ford.com.br/picapes/ranger/compare-as-versoes/',
        documentType: 'HTML',
      },
      {
        title: 'ford.com.br/content/dam/ficha-tecnica.pdf',
        url: 'https://www.ford.com.br/content/dam/ficha-tecnica.pdf',
        documentType: 'PDF',
      },
    ],
  });
  expect((result as { message: string }).message).toContain(
    '3 brochure PDF(s) and 1 page(s)',
  );
  // Only HTML pages are read for links; the PDF citation is not downloaded.
  expect(downloadSource).toHaveBeenCalledTimes(1);
  expect(generate.mock.calls[0]?.[0]).toBe(
    JSON.stringify({ brand: 'Ford', model: 'Ranger', modelYear: 2026 }),
  );
});

it('reports EMPTY with guidance when no approved page is behind the citations', async () => {
  generate.mockResolvedValue({
    text: '',
    sources: [
      {
        payload: { sourceType: 'url', title: 'scribd.com', url: redirect('s') },
      },
    ],
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://scribd.com/doc' },
        }),
    ),
  );
  const result = await discoverVehicleSpecificationSources.execute?.(
    { brand: 'Ford', model: 'Ranger', modelYear: 2026 },
    context,
  );
  expect(result).toMatchObject({ status: 'EMPTY', items: [] });
  expect((result as { message: string }).message).toContain(
    'official manufacturer URL',
  );
  expect(downloadSource).not.toHaveBeenCalled();
});

it('keeps the pages when reading them for brochures fails', async () => {
  generate.mockResolvedValue({
    text: '',
    sources: [
      {
        payload: {
          sourceType: 'url',
          title: 'ford.com.br',
          url: redirect('f'),
        },
      },
    ],
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://www.ford.com.br/picapes/ranger/' },
        }),
    ),
  );
  downloadSource.mockRejectedValue(new Error('Source returned HTTP 403.'));
  const result = await discoverVehicleSpecificationSources.execute?.(
    { brand: 'Ford', model: 'Ranger', modelYear: 2026 },
    context,
  );
  expect(result).toMatchObject({
    status: 'OK',
    items: [
      { url: 'https://www.ford.com.br/picapes/ranger/', documentType: 'HTML' },
    ],
  });
});

it('reports ERROR only when both web search and the site index fail', async () => {
  generate.mockRejectedValue(new Error('quota'));
  const result = await discoverVehicleSpecificationSources.execute?.(
    { brand: 'Ford', model: 'Ranger', modelYear: 2026 },
    context,
  );
  expect(result).toMatchObject({ status: 'ERROR', items: [] });
});

it('lists the sitemap pages and their brochures even when web search fails', async () => {
  generate.mockRejectedValue(new Error('quota'));
  wellKnownModelPages.mockResolvedValue([
    {
      url: 'https://www.ford.com.br/picapes/ranger/compare-as-versoes/',
      html: '<a href="/content/dam/ranger/fbr-ranger-ficha-tecnica.pdf">Ficha técnica</a>',
    },
    { url: 'https://www.ford.com.br/picapes/ranger/' },
  ]);
  downloadSource.mockResolvedValue({
    url: new URL('https://www.ford.com.br/picapes/ranger/'),
    mime: 'text/html',
    bytes: Buffer.from(
      '<a href="/content/dam/ranger/fbr-ranger-ficha-tecnica.pdf">same</a>',
    ),
  });
  const result = await discoverVehicleSpecificationSources.execute?.(
    { brand: 'Ford', model: 'Ranger', modelYear: 2026 },
    context,
  );
  expect(result).toMatchObject({
    status: 'OK',
    items: [
      {
        title: 'Ficha técnica',
        url: 'https://www.ford.com.br/content/dam/ranger/fbr-ranger-ficha-tecnica.pdf',
        documentType: 'PDF',
      },
      {
        title: 'ford.com.br/picapes/ranger/compare-as-versoes',
        url: 'https://www.ford.com.br/picapes/ranger/compare-as-versoes/',
        documentType: 'HTML',
      },
      { title: 'ford.com.br/picapes/ranger', documentType: 'HTML' },
    ],
  });
  // The page whose body the site index already holds is not downloaded again.
  expect(downloadSource).toHaveBeenCalledTimes(1);
  expect(wellKnownModelPages).toHaveBeenCalledWith(
    'Ford',
    'Ranger',
    expect.any(AbortSignal),
  );
});
