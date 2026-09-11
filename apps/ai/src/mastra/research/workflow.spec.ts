import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capture, identify, extract, request } = vi.hoisted(() => ({
  capture: vi.fn(),
  identify: vi.fn(),
  extract: vi.fn(),
  request: vi.fn(),
}));
vi.mock('../ingestion/source', async (original) => ({
  ...(await original<typeof import('../ingestion/source')>()),
  captureSource: capture,
}));
vi.mock('../ingestion/identification', async (original) => ({
  ...(await original<typeof import('../ingestion/identification')>()),
  identifyConfigurations: identify,
}));
vi.mock('../ingestion/extraction', async (original) => ({
  ...(await original<typeof import('../ingestion/extraction')>()),
  extractConfigurationClaims: extract,
}));
vi.mock('./client', () => ({ researchRequest: request }));

import {
  COVERAGE_WARNING,
  executeSharedResearch,
  interpretationKey,
  runSharedResearch,
} from './workflow';

const input = {
  workId: 'b0bf3b8d-12fb-45ae-83d4-5b41b61c559a',
  attemptId: 'b98e8caa-d7e5-4440-8a9c-f5c267ab3fb1',
  policyVersion: 'br-v1',
  request: {
    sourceUrl: 'https://www.ford.com.br/ranger.pdf',
    brand: 'Ford',
    model: 'Ranger',
    market: 'BR' as const,
    modelYear: 2025,
    configurations: ['Limited'],
  },
  attributes: [],
};
const source = {
  url: input.request.sourceUrl,
  title: 'Ranger',
  mimeType: 'text/html',
  originalBase64: 'YQ==',
  originalSha256: 'hash',
  text: 'XL | Limited',
  textSha256: 'text-hash',
  parserVersion: 'v1',
  pageCount: 0,
};
const identity = (name: string) => ({
  name,
  powertrain: null,
  column: name,
  lineStart: 1,
  lineEnd: 1,
  locator: 'row 1',
  excerpt: source.text,
});
const identification = {
  configurations: [identity('XL'), identity('Limited')],
  legend: [],
  modelYearNote: null,
  notes: [],
};
const draft = (name: string) => ({
  name,
  identityLineStart: 1,
  identityLineEnd: 1,
  identityExcerpt: source.text,
  claims: [],
  warnings: [],
});
let checkpoints: Array<{ key: string; payload: string }>;

beforeEach(() => {
  vi.stubEnv('SPECSYNC_RESEARCH_POLICY_VERSION', 'br-v1');
  checkpoints = [];
  capture.mockReset().mockResolvedValue(source);
  identify.mockReset().mockResolvedValue(identification);
  extract
    .mockReset()
    .mockImplementation(async (value) => draft(value.scope.name));
  request
    .mockReset()
    .mockImplementation(
      async (
        method: string,
        path: string,
        body: { payload: string } | undefined,
      ) => {
        if (method === 'GET') return { checkpoints };
        if (method === 'PUT')
          checkpoints.push({
            key: path.split('/').at(-1) ?? '',
            payload: body?.payload ?? '',
          });
        return { ok: true };
      },
    );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

const execute = () =>
  executeSharedResearch(input, new AbortController().signal);

describe('shared research checkpoints', () => {
  it('replays extraction after an ontology change without reading the source or identifying again', async () => {
    await execute();
    capture.mockClear();
    identify.mockClear();
    extract.mockClear();
    const changed = {
      ...input,
      ontologyRevision: 2,
      normalizationRevision: 'numeric-v3',
    };
    const result = await executeSharedResearch(
      changed,
      new AbortController().signal,
    );
    expect(capture).not.toHaveBeenCalled();
    expect(identify).not.toHaveBeenCalled();
    expect(extract).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      ontologyRevision: 2,
      normalizationRevision: 'numeric-v3',
      readerRevision: 'v1',
    });
    expect(checkpoints).toHaveLength(6);
    expect(interpretationKey(changed, 'v1')).not.toBe(
      interpretationKey(input, 'v1'),
    );
    expect(interpretationKey(changed, 'v1')).not.toBe(
      interpretationKey(changed, 'v2'),
    );
    expect(interpretationKey(changed, 'v1')).not.toBe(
      interpretationKey(
        { ...changed, normalizationRevision: 'numeric-v4' },
        'v1',
      ),
    );
    expect(interpretationKey(changed, 'v1')).not.toBe(
      interpretationKey({ ...changed, policyVersion: 'br-v2' }, 'v1'),
    );
  });
  it('runs the real Mastra workflow wrapper with the lease attempt id', async () => {
    const result = await runSharedResearch(input, new AbortController().signal);
    expect(result.configurations.map((item) => item.name)).toEqual([
      'XL',
      'Limited',
    ]);
    expect(checkpoints).toHaveLength(4);
  });

  it('extracts every discovered configuration, ignores personal trim scope and preserves evidence', async () => {
    const result = await execute();
    expect(result.configurations.map((item) => item.name)).toEqual([
      'XL',
      'Limited',
    ]);
    expect(result.source).toMatchObject({
      textSha256: 'text-hash',
      text: 'XL | Limited',
    });
    expect(result.warnings).toContain(COVERAGE_WARNING);
    expect(identify.mock.calls[0]?.[1]).toMatchObject({ configurations: [] });
    expect(capture.mock.calls[0]?.slice(2, 4)).toEqual([undefined, undefined]);
    expect(checkpoints.map((item) => item.key)).toEqual([
      'capture-source',
      'identify-configurations',
      `extract-${interpretationKey(input, source.parserVersion)}-configuration-0`,
      `extract-${interpretationKey(input, source.parserVersion)}-configuration-1`,
    ]);
    expect(
      request.mock.calls.every((call) =>
        String(call[1]).includes(
          `/works/${input.workId}/attempts/${input.attemptId}/`,
        ),
      ),
    ).toBe(true);
  });

  it('propagates HTTP cancellation through the real Mastra wrapper', async () => {
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    capture.mockImplementation(
      (_url, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
          started();
        }),
    );
    const caller = new AbortController();
    const pending = runSharedResearch(input, caller.signal);
    const rejected = expect(pending).rejects.toThrow();
    await ready;
    caller.abort();
    await rejected;
    expect(identify).not.toHaveBeenCalled();
  });

  it('reuses completed stages across attempts and extracts only the missing configuration', async () => {
    checkpoints = [
      { key: 'capture-source', payload: JSON.stringify(source) },
      {
        key: 'identify-configurations',
        payload: JSON.stringify(identification),
      },
      {
        key: `extract-${interpretationKey(input, source.parserVersion)}-configuration-0`,
        payload: JSON.stringify(draft('XL')),
      },
    ];
    await execute();
    expect(capture).not.toHaveBeenCalled();
    expect(identify).not.toHaveBeenCalled();
    expect(extract).toHaveBeenCalledOnce();
    expect(extract.mock.calls[0]?.[0].scope.name).toBe('Limited');
  });

  it('fails before callbacks or model work when the policy changed or caller already aborted', async () => {
    await expect(
      executeSharedResearch(
        { ...input, policyVersion: 'old' },
        new AbortController().signal,
      ),
    ).rejects.toThrow('policy changed');
    await expect(
      runSharedResearch(input, AbortSignal.abort()),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not restart capture after an invalid durable checkpoint', async () => {
    checkpoints = [{ key: 'capture-source', payload: '{}' }];
    await expect(execute()).rejects.toThrow();
    expect(capture).not.toHaveBeenCalled();
  });

  it('stops before saving or spending again when ownership is lost', async () => {
    capture.mockImplementation(async () => {
      request.mockRejectedValue(new Error('lease expired'));
      return source;
    });
    await expect(execute()).rejects.toThrow('lease expired');
    expect(identify).not.toHaveBeenCalled();
    expect(checkpoints).toEqual([]);
  });

  it('aborts an in-flight model operation on heartbeat failure and clears its timer', async () => {
    vi.useFakeTimers();
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    capture.mockImplementation(
      (_url, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          });
          started();
        }),
    );
    const pending = execute();
    const rejected = expect(pending).rejects.toThrow('lease expired');
    await ready;
    request.mockRejectedValue(new Error('lease expired'));
    await vi.advanceTimersByTimeAsync(30_000);
    await rejected;
    expect(identify).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds configuration extraction concurrency to two', async () => {
    identification.configurations = ['XL', 'XLS', 'XLT', 'Limited'].map(
      identity,
    );
    let active = 0;
    let peak = 0;
    extract.mockImplementation(async (value) => {
      active++;
      peak = Math.max(active, peak);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return draft(value.scope.name);
    });
    try {
      await execute();
      expect(peak).toBe(2);
      expect(extract).toHaveBeenCalledTimes(4);
    } finally {
      identification.configurations = [identity('XL'), identity('Limited')];
    }
  });
});
