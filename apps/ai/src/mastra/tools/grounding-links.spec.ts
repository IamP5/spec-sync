import { afterEach, expect, it, vi } from 'vitest';

import {
  describeSource,
  isGroundingRedirect,
  resolveGroundedSources,
  resolveGroundingUrl,
} from './grounding-links';

const redirect =
  'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQEeEr8w';

afterEach(() => vi.unstubAllGlobals());

it('only treats the Google grounding host as a redirect link', () => {
  expect(isGroundingRedirect(redirect)).toBe(true);
  expect(isGroundingRedirect('https://www.ford.com.br/picapes/ranger/')).toBe(
    false,
  );
  expect(isGroundingRedirect('http://vertexaisearch.cloud.google.com/x')).toBe(
    false,
  );
  expect(isGroundingRedirect('not a url')).toBe(false);
  expect(
    isGroundingRedirect(redirect.replace('https://', 'https://user@')),
  ).toBe(false);
  expect(isGroundingRedirect(redirect.replace('.com/', '.com:8443/'))).toBe(
    false,
  );
  expect(
    isGroundingRedirect('https://vertexaisearch.cloud.google.com/unrelated'),
  ).toBe(false);
});

it('uses one bounded GET fallback when HEAD does not expose the redirect', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 405 }))
    .mockResolvedValueOnce(
      new Response('unused body', {
        status: 302,
        headers: { location: 'https://www.ram.com.br/picapes/1500.html' },
      }),
    );
  vi.stubGlobal('fetch', fetch);
  await expect(resolveGroundingUrl(redirect)).resolves.toBe(
    'https://www.ram.com.br/picapes/1500.html',
  );
  expect(
    fetch.mock.calls.map(([url, options]) => [
      url,
      options.method,
      options.redirect,
    ]),
  ).toEqual([
    [redirect, 'HEAD', 'manual'],
    [redirect, 'GET', 'manual'],
  ]);
  expect(fetch.mock.calls[0]?.[1].signal).toBe(fetch.mock.calls[1]?.[1].signal);
});

it('does not perform redirect requests after cancellation', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  await expect(
    resolveGroundingUrl(redirect, AbortSignal.abort()),
  ).resolves.toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});

it('reads the real page from the redirect without following it', async () => {
  const fetch = vi.fn(
    async () =>
      new Response(null, {
        status: 302,
        headers: {
          location:
            'https://www.ford.com.br/picapes/ranger/compare-as-versoes/',
        },
      }),
  );
  vi.stubGlobal('fetch', fetch);
  await expect(resolveGroundingUrl(redirect)).resolves.toBe(
    'https://www.ford.com.br/picapes/ranger/compare-as-versoes/',
  );
  expect(fetch).toHaveBeenCalledWith(
    redirect,
    expect.objectContaining({ method: 'HEAD', redirect: 'manual' }),
  );
});

it('returns other URLs untouched and drops redirects it cannot resolve', async () => {
  const fetch = vi.fn(async () => new Response('ok', { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  await expect(resolveGroundingUrl('https://www.ford.com.br/')).resolves.toBe(
    'https://www.ford.com.br/',
  );
  expect(fetch).not.toHaveBeenCalled();
  await expect(resolveGroundingUrl(redirect)).resolves.toBeUndefined();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('network');
    }),
  );
  await expect(resolveGroundingUrl(redirect)).resolves.toBeUndefined();
});

it('resolves grounded sources in order, skipping non-URL and unresolved ones', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.endsWith('/a')
        ? new Response(null, {
            status: 302,
            headers: { location: 'https://www.ford.com.br/a' },
          })
        : new Response(null, { status: 404 }),
    ),
  );
  await expect(
    resolveGroundedSources([
      {
        payload: {
          sourceType: 'url',
          title: 'ford.com.br',
          url: `${redirect}/a`,
        },
      },
      { payload: { sourceType: 'url', title: 'gone', url: `${redirect}/b` } },
      { payload: { sourceType: 'document', title: 'doc' } },
      {
        payload: {
          sourceType: 'url',
          url: 'https://www.toyota.com.br/corolla',
        },
      },
    ]),
  ).resolves.toEqual([
    { title: 'ford.com.br', url: 'https://www.ford.com.br/a' },
    { title: '', url: 'https://www.toyota.com.br/corolla' },
  ]);
});

it('describes a source by its path when the title is only the domain', () => {
  expect(
    describeSource(
      'ford.com.br',
      'https://www.ford.com.br/picapes/ranger/compare-as-versoes/',
    ),
  ).toBe('ford.com.br/picapes/ranger/compare-as-versoes');
  expect(describeSource('ford.com.br', 'https://www.ford.com.br/')).toBe(
    'ford.com.br',
  );
  expect(
    describeSource('Nova Ranger', 'https://www.ford.com.br/picapes/ranger/'),
  ).toBe('Nova Ranger');
  expect(describeSource('', 'https://www.ford.com.br/x/y')).toBe(
    'ford.com.br/x/y',
  );
});
