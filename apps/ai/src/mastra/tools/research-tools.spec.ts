import {
  MASTRA_RESOURCE_ID_KEY,
  RequestContext,
} from '@mastra/core/request-context';
import { noopObserve } from '@mastra/core/tools';
import { beforeEach, expect, it, vi } from 'vitest';

const { create, read, replay } = vi.hoisted(() => ({
  create: vi.fn(),
  read: vi.fn(),
  replay: vi.fn(),
}));
vi.mock('../research/client', () => ({
  createResearch: create,
  readResearch: read,
  replayResearch: replay,
}));

import type { ResearchSnapshot } from '../research/contracts';
import {
  getVehicleResearch,
  replayVehicleResearch,
  researchVehicleSpecifications,
} from './research-tools';

const request = {
  sourceUrl: 'https://ford.com.br/ranger.pdf',
  brand: 'Ford',
  model: 'Ranger',
  market: 'BR' as const,
  modelYear: 2025,
  configurations: ['Limited'],
};
const id = 'b0bf3b8d-12fb-45ae-83d4-5b41b61c559a';
const snapshot: ResearchSnapshot = {
  id,
  workId: 'b98e8caa-d7e5-4440-8a9c-f5c267ab3fb1',
  requestStatus: 'ACTIVE',
  disposition: 'JOINED',
  request,
  status: 'REVIEW',
  attempts: 1,
  stage: 'review',
  configurations: [],
  warnings: [],
  error: null,
  source: null,
  configurationIds: {},
  createdAt: '2026-09-08T12:00:00Z',
  updatedAt: '2026-09-08T12:01:00Z',
};
const context = (uid: string) => {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, `user:${uid}`);
  return { requestContext, observe: noopObserve };
};

beforeEach(() => {
  create.mockReset().mockResolvedValue(snapshot);
  read.mockReset().mockResolvedValue(snapshot);
  replay.mockReset().mockResolvedValue(snapshot);
});

it('replays immutable evidence using only the verified private request and a fresh id', async () => {
  const result = await replayVehicleResearch.execute?.(
    { id },
    context('real-user'),
  );
  expect(replay.mock.calls[0]?.slice(0, 2)).toEqual(['real-user', id]);
  expect(replay.mock.calls[0]?.[2]).toMatch(/^[a-f0-9-]{36}$/);
  expect(result).toMatchObject({ id, status: 'REVIEW' });
  await expect(
    replayVehicleResearch.execute?.({ id }, { observe: noopObserve }),
  ).rejects.toThrow('Authentication required');
  expect(replay).toHaveBeenCalledOnce();
});

it('takes identity from verified resource context and generates the private request id itself', async () => {
  await researchVehicleSpecifications.execute?.(request, context('real-user'));
  expect(create.mock.calls[0]?.[0]).toBe('real-user');
  expect(create.mock.calls[0]?.[1]).toMatchObject({ request });
  expect(create.mock.calls[0]?.[1].id).toMatch(/^[a-f0-9-]{36}$/);
});

it('isolates both tools by the verified user even when callers reference the same shared work', async () => {
  for (const uid of ['user-a', 'user-b']) {
    await researchVehicleSpecifications.execute?.(request, context(uid));
    await getVehicleResearch.execute?.({ id }, context(uid));
  }
  expect(create.mock.calls.map((call) => call[0])).toEqual([
    'user-a',
    'user-b',
  ]);
  expect(read.mock.calls.map((call) => call.slice(0, 2))).toEqual([
    ['user-a', id],
    ['user-b', id],
  ]);
});

it('refuses user ids outside verified memory context', async () => {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, 'chat');
  await expect(
    researchVehicleSpecifications.execute?.(request, {
      requestContext,
      observe: noopObserve,
    }),
  ).rejects.toThrow('Authentication required');
  await expect(
    getVehicleResearch.execute?.({ id }, { observe: noopObserve }),
  ).rejects.toThrow('Authentication required');
  expect(create).not.toHaveBeenCalled();
  expect(read).not.toHaveBeenCalled();
});

it('returns bounded progress from both tools for an eight-configuration, 800-claim draft', async () => {
  const large: ResearchSnapshot = {
    ...snapshot,
    source: {
      url: request.sourceUrl,
      title: 'Manufacturer brochure',
      mimeType: 'application/pdf',
      originalSha256: 'private-source-hash',
      textSha256: 'private-text-hash',
      parserVersion: 'private-parser-version',
    },
    warnings: Array.from(
      { length: 20 },
      (_, index) => `Document warning ${index}`,
    ),
    configurations: Array.from({ length: 8 }, (_, configuration) => ({
      name: `Configuration ${configuration}`,
      identityLineStart: 1,
      identityLineEnd: 1,
      identityExcerpt: 'private-identity-excerpt',
      claims: Array.from({ length: 100 }, (_, index) => ({
        attributeCode: `attribute-${index}`,
        label: `Attribute ${index}`,
        unit: 'Nm',
        rawValue: '600',
        rawUnit: 'Nm',
        availability: null,
        listValue: null,
        qualifiers: { fuel: 'diesel' },
        lineStart: 2,
        lineEnd: 2,
        excerpt: 'private-evidence-'.repeat(100),
        locator: 'private-table-row',
        value: 600,
        issues: index < 2 ? ['unit mismatch'] : [],
      })),
      warnings: ['Configuration needs review'],
    })),
  };
  create.mockResolvedValue(large);
  read.mockResolvedValue(large);
  const results = [
    await researchVehicleSpecifications.execute?.(
      request,
      context('real-user'),
    ),
    await getVehicleResearch.execute?.({ id }, context('real-user')),
  ];
  for (const result of results) {
    expect(result).toMatchObject({
      id,
      source: { url: request.sourceUrl, title: 'Manufacturer brochure' },
      warningCount: 28,
    });
    expect(result).toHaveProperty(
      'configurations',
      Array.from({ length: 8 }, (_, index) => ({
        name: `Configuration ${index}`,
        claimCount: 100,
        issueCount: 2,
        unmappedCount: 0,
      })),
    );
    expect(result).toHaveProperty('warnings', large.warnings.slice(0, 10));
    const encoded = JSON.stringify(result);
    expect(encoded).not.toContain('private-');
    expect(encoded).not.toContain('rawValue');
    expect(encoded.length).toBeLessThan(3_000);
  }
  expect(large.configurations[0]?.claims).toHaveLength(100);
  expect(large.warnings).toHaveLength(20);
});
