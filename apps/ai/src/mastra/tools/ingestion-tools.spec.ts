import { noopObserve } from '@mastra/core/tools';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock('@mastra/core/agent', () => ({
  Agent: class {
    generate = generate;
  },
}));

const {
  downloadSource,
  probeSourceMetadata,
  wellKnownModelPages,
  captureSourceCached,
} = vi.hoisted(() => ({
  downloadSource: vi.fn(),
  probeSourceMetadata: vi.fn(),
  wellKnownModelPages: vi.fn(),
  captureSourceCached: vi.fn(),
}));
vi.mock('../ingestion/source', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ingestion/source')>()),
  downloadSource,
  probeSourceMetadata,
  captureSourceCached,
}));
vi.mock('../ingestion/site-index', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ingestion/site-index')>()),
  wellKnownModelPages,
}));

const { identifyConfigurations, recordToolUsage } = vi.hoisted(() => ({
  identifyConfigurations: vi.fn(),
  recordToolUsage: vi.fn(),
}));
vi.mock('../ingestion/identification', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ingestion/identification')>()),
  identifyConfigurations,
}));
vi.mock('../credits/credits-run', () => ({ recordToolUsage }));

import {
  discoverVehicleSpecificationSources,
  previewVehicleSource,
} from './ingestion-tools';

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
  probeSourceMetadata.mockReset();
  wellKnownModelPages.mockReset();
  captureSourceCached.mockReset();
  identifyConfigurations.mockReset();
  recordToolUsage.mockReset();
  vi.unstubAllEnvs();
});
beforeEach(() => {
  wellKnownModelPages.mockResolvedValue([]);
  probeSourceMetadata.mockImplementation(async (url: string) => ({
    url,
    mime: 'application/pdf',
    byteLength: 1234,
  }));
});

import { discoveryResultSchema } from '../ingestion/source-discovery';
const discover = async (brand = 'Ford', model = 'Ranger', modelYear = 2026) =>
  discoveryResultSchema.parse(
    await discoverVehicleSpecificationSources.execute?.(
      { brand, model, modelYear },
      context,
    ),
  );
const grounded = (url: string, title = '') => ({
  payload: { sourceType: 'url', url, title },
});
const html = (url: string, body: string) => ({
  url: new URL(url),
  mime: 'text/html',
  bytes: Buffer.from(body),
});

it('uses a published model brochure without paying for grounding and normalizes F150', async () => {
  wellKnownModelPages.mockResolvedValue([
    {
      url: 'https://www.ford.com.br/picapes/f-150/',
      html: '<a href="/docs/f-150-ficha-tecnica.pdf">Ficha técnica</a>',
    },
  ]);
  const result = await discover('Ford', 'F150');
  expect(generate).not.toHaveBeenCalled();
  expect(downloadSource).not.toHaveBeenCalled();
  expect(result.resolvedScope).toEqual({
    brand: 'Ford',
    model: 'F-150',
    modelYear: 2026,
    market: 'BR',
  });
  expect(result.items[0]).toMatchObject({
    documentType: 'PDF',
    applicability: 'UNVERIFIED',
    yearHint: null,
    availability: 'READABLE',
  });
  expect(result.diagnostics.search).toBe('SKIPPED');
});

it('resolves grounded redirects, preserves external sources and filters manuals', async () => {
  generate.mockResolvedValue({
    sources: [grounded(redirect('foreign')), grounded(redirect('ford'))],
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(null, {
          status: 302,
          headers: {
            location: url.endsWith('ford')
              ? 'https://www.ford.com.br/picapes/ranger/'
              : 'https://files.example.org/ranger.pdf',
          },
        }),
    ),
  );
  downloadSource.mockImplementation(async (url: string) =>
    html(
      url,
      '<a href="/docs/ranger-manual.pdf">Manual</a><a href="/docs/ranger-ficha-2026.pdf">Ficha técnica</a>',
    ),
  );
  const result = await discover();
  expect(result.items).toHaveLength(3);
  expect(result.items[0]).toMatchObject({
    url: 'https://www.ford.com.br/docs/ranger-ficha-2026.pdf',
    yearHint: 2026,
    applicability: 'UNVERIFIED',
  });
  expect(result.diagnostics.search).toBe('COMPLETED');
  expect(recordToolUsage).toHaveBeenCalledOnce();
});

it.each(['Ram1500', ' RAM1500 ', ' Ram 1500 '])(
  'finds a grounded official RAM PDF for %s even if official pages cannot be read',
  async (model) => {
    wellKnownModelPages.mockRejectedValue(new Error('HTTP 403'));
    generate.mockResolvedValue({
      sources: [
        grounded(
          'https://www.ram.com.br/docs/catalogo-1500-2026.pdf',
          'RAM 1500 catálogo 2026',
        ),
      ],
    });
    const result = await discover('RAM', model);
    expect(result.status).toBe('OK');
    expect(result.resolvedScope.model).toBe('1500');
    expect(result.items[0]).toMatchObject({
      url: 'https://www.ram.com.br/docs/catalogo-1500-2026.pdf',
      documentType: 'PDF',
      availability: 'READABLE',
      applicability: 'UNVERIFIED',
    });
    expect(downloadSource).not.toHaveBeenCalled();
    expect(JSON.parse(generate.mock.calls[0]?.[0])).toMatchObject({
      preferredManufacturerDomains: ['ram.com.br'],
      model: '1500',
      modelYear: 2026,
    });
  },
);

it('coalesces observed redirect destinations before applying the ten-item result budget', async () => {
  const canonical = 'https://www.ford.com.br/picapes/f-150/lariat/';
  generate.mockResolvedValue({
    sources: [
      grounded('https://www.ford.com.br/picapes/f-150/alias-one/', 'F150'),
      grounded('https://www.ford.com.br/picapes/f-150/alias-two/', 'F150'),
      ...Array.from({ length: 9 }, (_, index) =>
        grounded(
          `https://www.ford.com.br/picapes/f-150/details-${index}/`,
          'F150',
        ),
      ),
    ],
  });
  downloadSource.mockImplementation(async (url: string) =>
    html(url.includes('/alias-') ? canonical : url, '<p>F150</p>'),
  );
  const result = await discover('Ford', 'F150');
  expect(result.items.filter((item) => item.url === canonical)).toHaveLength(1);
  expect(result.items).toHaveLength(10);
  expect(result.items.some((item) => item.url.endsWith('/details-8/'))).toBe(
    true,
  );
});

it('follows observed specification-page links and deduplicates tracking URLs', async () => {
  wellKnownModelPages.mockResolvedValue([
    {
      url: 'https://www.ford.com.br/picapes/ranger/',
      html: '<a href="/ranger/ficha.html?utm_source=a">Ficha técnica</a><a href="/ranger/ficha.html?utm_source=b">Ficha técnica</a><a href="https://127.0.0.1/ranger/ficha.html">Ficha técnica</a>',
    },
  ]);
  downloadSource.mockImplementation(async (url: string) =>
    html(url, '<a href="/docs/ranger-catalogo.pdf">Catálogo</a>'),
  );
  const result = await discover();
  expect(downloadSource).toHaveBeenCalledOnce();
  expect(generate).not.toHaveBeenCalled();
  expect(result.items[0]?.url).toBe(
    'https://www.ford.com.br/docs/ranger-catalogo.pdf',
  );
});

it('retains readable HTML above oversized RAM brochures without downloading PDF bodies', async () => {
  wellKnownModelPages.mockResolvedValue([
    {
      url: 'https://www.ram.com.br/picapes/1500.html',
      html: '<a href="/catalogo-1500-2025.pdf">Catálogo 2025</a>',
    },
  ]);
  probeSourceMetadata.mockImplementation(async (url: string) => ({
    url,
    mime: 'application/pdf',
    byteLength: 24_000_000,
  }));
  generate.mockResolvedValue({ sources: [] });
  const result = await discover('RAM', '1500');
  expect(result.items[0]).toMatchObject({
    documentType: 'HTML',
    availability: 'READABLE',
    yearHint: null,
  });
  expect(result.items[1]).toMatchObject({
    documentType: 'PDF',
    availability: 'OVERSIZE',
    byteLength: 24_000_000,
    yearHint: 2025,
  });
  expect(result.warnings.join(' ')).toContain('5 MB');
  expect(result.warnings.join(' ')).toContain('another model year');
  expect(downloadSource).not.toHaveBeenCalled();
  expect(generate).toHaveBeenCalledTimes(2);
});

it('reports partial failures without hiding grounded links or exposing backend errors', async () => {
  generate.mockResolvedValue({
    sources: [grounded('https://www.ford.com.br/picapes/ranger/', 'Ranger')],
  });
  downloadSource.mockRejectedValue(new Error('private response secrets'));
  const result = await discover();
  expect(result.items[0]?.availability).toBe('UNREACHABLE');
  expect(result.diagnostics.pageFailures).toBe(1);
  expect(result.warnings).not.toHaveLength(0);
  expect(JSON.stringify(result)).not.toContain('private response secrets');
});

it('searches the public web for unlisted brands and falls back to reputable secondary sources', async () => {
  vi.stubEnv('SPECSYNC_INGESTION_SOURCE_DOMAINS', 'ford.com.br');
  generate.mockResolvedValueOnce({ sources: [] }).mockResolvedValueOnce({
    sources: [
      grounded(
        'https://www.webmotors.com.br/catalogo/byd/shark/ficha-tecnica-2024',
        'BYD Shark ficha técnica 2024',
      ),
    ],
  });
  downloadSource.mockImplementation(async (url: string) =>
    html(url, '<h1>BYD Shark 2024 ficha técnica</h1>'),
  );
  const result = await discover('BYD', 'Shark', 2024);
  expect(result.status).toBe('OK');
  expect(result.items[0]).toMatchObject({
    sourceType: 'EXTERNAL_WEBSITE',
    applicability: 'UNVERIFIED',
    availability: 'READABLE',
  });
  expect(result.warnings.join(' ')).not.toContain('approved domain');
  expect(
    generate.mock.calls.map((call) => JSON.parse(call[0]).searchStage),
  ).toEqual(['official', 'secondary']);
  expect(
    JSON.parse(generate.mock.calls[0]?.[0]).preferredManufacturerDomains,
  ).toEqual([]);
  expect(wellKnownModelPages).not.toHaveBeenCalled();
});

it('distinguishes unavailable grounding from an empty discovery and preserves cancellation', async () => {
  generate.mockRejectedValue(new Error('quota details'));
  expect((await discover()).status).toBe('ERROR');
  const abortSignal = AbortSignal.abort(new Error('cancelled'));
  await expect(
    discoverVehicleSpecificationSources.execute?.(
      { brand: 'Ford', model: 'Ranger', modelYear: 2026 },
      { ...context, abortSignal },
    ),
  ).rejects.toThrow('cancelled');
  expect(generate).toHaveBeenCalledTimes(2);
});

it('does not substitute unrelated models from the same approved manufacturer', async () => {
  generate.mockResolvedValue({
    sources: [
      grounded(
        'https://www.ford.com.br/docs/ranger-ficha-2026.pdf',
        'Ranger ficha técnica',
      ),
    ],
  });
  const result = await discover('Ford', 'F150');
  expect(result.status).toBe('EMPTY');
  expect(result.items).toEqual([]);
  expect(result.warnings.join(' ')).toContain(
    'none matched the requested model',
  );
  expect(probeSourceMetadata).not.toHaveBeenCalled();
});

it('rechecks model scope when an official page redirects to another model', async () => {
  generate.mockResolvedValue({
    sources: [grounded('https://www.ford.com.br/picapes/f-150/', 'F150 2026')],
  });
  downloadSource.mockResolvedValue(
    html(
      'https://www.ford.com.br/picapes/ranger/',
      '<a href="/docs/ranger-ficha-2026.pdf">Ficha técnica</a>',
    ),
  );
  const result = await discover('Ford', 'F150');
  expect(result.status).toBe('EMPTY');
  expect(result.items).toEqual([]);
  expect(probeSourceMetadata).not.toHaveBeenCalled();
});

it('does not retain a requested-year hint after a brochure redirects to an older year', async () => {
  generate.mockResolvedValue({
    sources: [
      grounded('https://www.ford.com.br/f-150-2026.pdf', 'F150 catálogo 2026'),
    ],
  });
  probeSourceMetadata.mockResolvedValue({
    url: 'https://www.ford.com.br/f-150-2025.pdf',
    mime: 'application/pdf',
    byteLength: 1234,
  });
  const result = await discover('Ford', 'F150');
  expect(result.items[0]).toMatchObject({
    yearHint: 2025,
    applicability: 'UNVERIFIED',
  });
  expect(result.warnings.join(' ')).toContain('another model year');
});

it('charges a PDF preview for the pages it transcribed and for the identification', async () => {
  // Two transcription batches, then the identification call.
  captureSourceCached.mockImplementation(
    async (
      _url: string,
      _signal: AbortSignal,
      onUsage?: (usage: unknown) => void,
    ) => {
      onUsage?.({ inputTokens: 4_000, outputTokens: 900 });
      onUsage?.({ inputTokens: 3_000, outputTokens: 600 });
      return {
        url: 'https://ford.com.br/ranger.pdf',
        title: 'ranger.pdf',
        mimeType: 'application/pdf',
        text: 'Page 1\nRanger XLT',
        pageCount: 2,
      };
    },
  );
  identifyConfigurations.mockResolvedValue({
    configurations: [],
    usage: { inputTokens: 500, outputTokens: 50 },
  });

  await previewVehicleSource.execute?.(
    {
      brand: 'Ford',
      model: 'Ranger',
      modelYear: 2026,
      sourceUrl: 'https://ford.com.br/ranger.pdf',
    },
    context,
  );

  // Each call charges under its own role, so the transcription is priced at
  // the vision tariff and the identification at its own.
  expect(recordToolUsage.mock.calls.map((call) => call[2])).toEqual([
    'vision',
    'identification',
  ]);
  expect(recordToolUsage.mock.calls.map((call) => call[3])).toEqual([
    {
      inputTokens: 7_000,
      cachedInputTokens: 0,
      outputTokens: 1_500,
      reasoningTokens: 0,
      estimated: false,
    },
    { inputTokens: 500, outputTokens: 50 },
  ]);
});

it('charges nothing for a transcription the capture cache served', async () => {
  captureSourceCached.mockResolvedValue({
    url: 'https://ford.com.br/ranger.pdf',
    title: 'ranger.pdf',
    mimeType: 'application/pdf',
    text: 'Page 1\nRanger XLT',
    pageCount: 2,
  });
  identifyConfigurations.mockResolvedValue({
    configurations: [],
    usage: { inputTokens: 500, outputTokens: 50 },
  });

  await previewVehicleSource.execute?.(
    {
      brand: 'Ford',
      model: 'Ranger',
      modelYear: 2026,
      sourceUrl: 'https://ford.com.br/ranger.pdf',
    },
    context,
  );

  // No pages were transcribed for this run, so the transcription reports
  // undefined usage, which the wallet skips; only the identification is charged.
  expect(recordToolUsage.mock.calls.map((call) => call[3])).toEqual([
    undefined,
    { inputTokens: 500, outputTokens: 50 },
  ]);
});

it('discovers the official BYD Shark brochure while preserving a conflicting requested year', async () => {
  const pdf =
    'https://www.byd.com/material/__CN/byd-site/br/fichas-tecnicas-2026/update-13-07-2026/07-13-2026---ficha-txiunica/BYD_Shark_V2.pdf';
  wellKnownModelPages.mockResolvedValue([
    {
      url: 'https://www.byd.com/br/car/shark',
      html: `<h1>BYD Shark</h1><a href="${pdf}">FICHA TÉCNICA</a>`,
    },
  ]);
  generate.mockResolvedValue({ sources: [] });
  const result = await discover('BYD', 'Shark', 2024);
  expect(result.status).toBe('OK');
  expect(result.resolvedScope).toEqual({
    brand: 'BYD',
    model: 'Shark',
    modelYear: 2024,
    market: 'BR',
  });
  expect(result.items).toContainEqual(
    expect.objectContaining({
      url: pdf,
      yearHint: 2026,
      applicability: 'UNVERIFIED',
      availability: 'READABLE',
    }),
  );
  expect(result.warnings.join(' ')).toContain('another model year');
  expect(result.warnings.join(' ')).not.toContain(
    'no configured approved domain',
  );
});

it('follows an official model page to a PDF on previously unknown shared hosting', async () => {
  const url =
    'https://shared-files.example.org/new-folder/specification-ex5.pdf';
  wellKnownModelPages.mockResolvedValue([
    {
      url: 'https://www.geelybrasil.com.br/ex5',
      html: `<h1>Geely EX5</h1><a href="${url}">Ficha técnica</a>`,
    },
  ]);
  const result = await discover('Geely', 'EX5');
  expect(result.items[0]).toMatchObject({
    url,
    sourceType: 'LINKED_FROM_MANUFACTURER',
    linkedFrom: 'https://www.geelybrasil.com.br/ex5',
    availability: 'READABLE',
    applicability: 'UNVERIFIED',
  });
  expect(generate).not.toHaveBeenCalled();
});
