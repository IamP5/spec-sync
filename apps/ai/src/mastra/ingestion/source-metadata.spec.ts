import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { lookup, request } = vi.hoisted(() => ({
  lookup: vi.fn(),
  request: vi.fn(),
}));
vi.mock('node:dns/promises', () => ({ lookup }));
vi.mock('node:https', () => ({ request }));

import { probeSourceMetadata } from './source';

const response = (statusCode: number, headers: Record<string, string>) =>
  Object.assign(new EventEmitter(), { statusCode, headers, destroy: vi.fn() });
const serve = (...responses: ReturnType<typeof response>[]) =>
  request.mockImplementation((_url, _options, callback) =>
    Object.assign(new EventEmitter(), {
      end: () => queueMicrotask(() => callback(responses.shift())),
    }),
  );
beforeEach(() => lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]));
afterEach(() => {
  lookup.mockReset();
  request.mockReset();
});

it('probes GET headers without consuming an oversized PDF body', async () => {
  const pdf = response(200, {
    'content-type': 'application/pdf',
    'content-length': '24702177',
  });
  serve(pdf);
  expect(
    await probeSourceMetadata(
      'https://www.ram.com.br/catalogo.pdf',
      new AbortController().signal,
    ),
  ).toEqual({
    url: 'https://www.ram.com.br/catalogo.pdf',
    mime: 'application/pdf',
    byteLength: 24702177,
  });
  expect(pdf.destroy).toHaveBeenCalledOnce();
  expect(pdf.listenerCount('data')).toBe(0);
  expect(request.mock.calls[0]?.[1].method).not.toBe('HEAD');
  const options = request.mock.calls[0]?.[1];
  const callback = vi.fn();
  options.lookup('www.ram.com.br', {}, callback);
  expect(callback).toHaveBeenCalledWith(null, '8.8.8.8', 4);
});

it('checks redirect hosts and private DNS before issuing requests', async () => {
  serve(
    response(302, { location: 'https://ram.com.br.evil.test/catalogo.pdf' }),
  );
  await expect(
    probeSourceMetadata(
      'https://www.ram.com.br/catalogo.pdf',
      new AbortController().signal,
    ),
  ).rejects.toThrow('approved manufacturer');
  expect(request).toHaveBeenCalledOnce();
  request.mockClear();
  lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
  await expect(
    probeSourceMetadata(
      'https://www.ram.com.br/catalogo.pdf',
      new AbortController().signal,
    ),
  ).rejects.toThrow('forbidden network');
  expect(request).not.toHaveBeenCalled();
});

it('preserves unknown length and refuses pre-cancelled work without network access', async () => {
  serve(response(200, { 'content-type': 'application/pdf' }));
  expect(
    (
      await probeSourceMetadata(
        'https://www.ford.com.br/catalogo.pdf',
        new AbortController().signal,
      )
    ).byteLength,
  ).toBeNull();
  lookup.mockClear();
  await expect(
    probeSourceMetadata(
      'https://www.ford.com.br/catalogo.pdf',
      AbortSignal.abort(new Error('cancelled')),
    ),
  ).rejects.toThrow('cancelled');
  expect(lookup).not.toHaveBeenCalled();
});
