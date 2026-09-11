import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogRequest } from '../catalog/api-client';
import { searchCatalog } from '../catalog/catalog-search';
import type { Comparison } from '../catalog/contracts';
import { retrieveReviewEvidence } from '../catalog/knowledge-results';
import {
  compileCompetitiveWorkspace,
  isCoherentCompetitiveWorkspace,
} from './competitive-compiler';
import {
  type CompetitiveAction,
  competitivePlanSchema,
  competitiveWorkspaceInputSchema,
  type CompetitiveWorkspaceOutput,
  competitiveWorkspaceOutputSchema,
} from './competitive-contracts';
import {
  applyCompetitiveAction,
  competitiveHistory,
  latestCompetitiveWorkspace,
  validateCompetitiveAction,
} from './competitive-history';
import {
  calculateTargetScenario,
  retrieveCompetitiveWorkspace,
} from './competitive-retrieval';

vi.mock('../catalog/api-client', async (original) => ({
  ...(await original<typeof import('../catalog/api-client')>()),
  catalogRequest: vi.fn(),
}));
vi.mock('../catalog/catalog-search', async (original) => ({
  ...(await original<typeof import('../catalog/catalog-search')>()),
  searchCatalog: vi.fn(),
}));
vi.mock('../catalog/knowledge-results', async (original) => ({
  ...(await original<typeof import('../catalog/knowledge-results')>()),
  retrieveReviewEvidence: vi.fn(),
}));

const fordId = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1';
const rivalId = 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a2';
const surfaceId = `competitive-${fordId}`;
const attribute = {
  id: fordId,
  code: 'torque',
  label: 'Torque',
  description: null,
  valueType: 'NUMBER' as const,
  unit: 'Nm',
};
const ford = {
  id: fordId,
  brand: 'Ford',
  model: 'Ranger',
  name: 'Limited',
  market: 'BR',
  modelYear: 2026,
  identityStatus: 'RESOLVED',
  identityNote: null,
  identityEvidenceId: null,
};
const rival = { ...ford, id: rivalId, brand: 'Toyota', model: 'Hilux' };
const source = {
  id: fordId,
  sourceRevisionId: rivalId,
  title: 'Manufacturer specification',
  path: 'ranger.txt',
  sha256: 'immutable-digest',
  provenance: 'MANUFACTURER',
  capturedOn: '2026-09-10',
  publishedOn: null,
  upstreamUrls: ['https://example.com/spec.pdf'],
  lineStart: 10,
  lineEnd: 12,
  locator: 'p. 3',
  excerpt: 'Maximum torque 600 Nm with specified conditions.',
};
const comparison: Comparison = {
  configurations: [ford, rival],
  rows: [
    {
      attribute,
      cells: [
        {
          configurationId: fordId,
          knowledgeStatus: 'KNOWN',
          reason: null,
          selectedObservationId: fordId,
          observations: [
            {
              id: fordId,
              value: 600,
              availability: null,
              qualifiers: { engine: 'V6', rpm: '1750–2250' },
              rawValue: '600 Nm',
              reviewStatus: 'ACCEPTED',
              evidence: [source],
            },
          ],
        },
        {
          configurationId: rivalId,
          knowledgeStatus: 'CONFLICTING',
          reason: 'Different test conditions.',
          selectedObservationId: null,
          observations: [
            {
              id: rivalId,
              value: 700,
              availability: null,
              qualifiers: {},
              rawValue: '700 Nm',
              reviewStatus: 'ACCEPTED',
              evidence: [source],
            },
          ],
        },
      ],
    },
  ],
};
const catalog = {
  status: 'OK' as const,
  items: [ford, rival],
  limit: 12,
  offset: 0,
  hasMore: false,
  nextSearches: [],
  notices: [],
};
const reviews = {
  kind: 'reviews' as const,
  status: 'EMPTY' as const,
  message: 'No indexed passages.',
  projectionVersion: null,
  items: [],
};
const plan = competitivePlanSchema.parse({
  title: 'Pickup benchmark',
  context: {
    objective: 'Assess torque evidence and engineering targets',
    market: 'BR',
    modelYear: 2026,
    baselineConfigurationId: fordId,
    selectedConfigurationIds: [fordId, rivalId],
    attributes: ['torque'],
    focusAreas: ['powertrain'],
  },
  layout: 'analysis',
  panels: [
    { id: 'comparison', type: 'comparison', title: 'Accepted specification' },
    { id: 'gaps', type: 'gaps', title: 'Unresolved evidence' },
    {
      id: 'scenario',
      type: 'scenario',
      title: 'Target sensitivity',
      attributeCode: 'torque',
      targetValue: 550,
    },
  ],
});

function stored(
  output: CompetitiveWorkspaceOutput,
  callId = `call-${output.revision}`,
): MastraDBMessage {
  return {
    id: `message-${callId}`,
    role: 'assistant',
    threadId: 'thread',
    resourceId: 'user:test',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: callId,
            toolName: 'renderCompetitiveWorkspace',
            args: output.snapshot.plan,
            result: output,
          },
        },
      ],
    },
  };
}
function result(baseRevision = 0, actionId?: string) {
  const [comparisonPanel, gapPanel, scenarioPanel] = plan.panels;
  if (!comparisonPanel || !gapPanel || !scenarioPanel)
    throw new Error('Missing fixture panels');
  return compileCompetitiveWorkspace(
    plan,
    [
      {
        id: 'comparison',
        title: 'Accepted specification',
        type: 'comparison',
        args: comparisonPanel,
        result: comparison,
      },
      {
        id: 'gaps',
        title: 'Unresolved evidence',
        type: 'gaps',
        args: gapPanel,
        result: {
          status: 'OK',
          comparison,
          items: [
            {
              configurationId: rivalId,
              attributeCode: 'torque',
              knowledgeStatus: 'CONFLICTING',
              reason: 'Different test conditions.',
              observationCount: 1,
            },
          ],
        },
      },
      {
        id: 'scenario',
        title: 'Target sensitivity',
        type: 'scenario',
        args: scenarioPanel,
        result: calculateTargetScenario(comparison, {
          id: 'scenario',
          type: 'scenario',
          title: 'Target sensitivity',
          attributeCode: 'torque',
          targetValue: 550,
        }),
      },
    ],
    [attribute],
    { surfaceId, baseRevision, actionId },
  );
}
function action(): CompetitiveAction {
  return {
    version: 1,
    actionId: rivalId,
    surfaceId,
    expectedRevision: 1,
    componentId: 'brief',
    action: 'applyBrief',
    values: plan.context,
  };
}
beforeEach(() => {
  vi.mocked(catalogRequest)
    .mockReset()
    .mockImplementation(async (path) =>
      path === '/api/comparison-attributes'
        ? { items: [attribute] }
        : comparison,
    );
  vi.mocked(searchCatalog).mockReset().mockResolvedValue(catalog);
  vi.mocked(retrieveReviewEvidence).mockReset().mockResolvedValue(reviews);
});

describe('competitive DSL and compiler', () => {
  it('rejects unknown fields, duplicate or reserved panels, unbounded searches and invented IDs', () => {
    for (const invalid of [
      { ...plan, html: '<script>' },
      { ...plan, panels: [...plan.panels, plan.panels[0]] },
      { ...plan, panels: [{ id: 'brief', type: 'comparison', title: 'Bad' }] },
      {
        ...plan,
        panels: Array.from({ length: 7 }, (_, index) => ({
          id: `panel-${index}`,
          type: 'comparison',
          title: 'Too many',
        })),
      },
      {
        ...plan,
        context: { ...plan.context, selectedConfigurationIds: ['made-up-id'] },
      },
      {
        ...plan,
        context: { ...plan.context, attributes: Array(13).fill('torque') },
      },
      {
        ...plan,
        panels: [
          {
            id: 'selection',
            type: 'selection',
            title: 'Catalog',
            searches: [{ q: 'Ranger', limit: 9 }],
          },
        ],
      },
      {
        ...plan,
        panels: [
          {
            id: 'one',
            type: 'selection',
            title: 'One',
            searches: [{ q: 'Ford' }],
          },
          {
            id: 'two',
            type: 'selection',
            title: 'Two',
            searches: [{ q: 'Toyota' }],
          },
        ],
      },
    ])
      expect(competitiveWorkspaceInputSchema.safeParse(invalid).success).toBe(
        false,
      );
  });

  it('emits full replay snapshots but creates a surface only at its first revision', () => {
    const initial = result();
    const update = result(1, rivalId);
    expect(competitiveWorkspaceOutputSchema.safeParse(update).success).toBe(
      true,
    );
    expect(initial.operations).toHaveLength(3);
    expect(update.operations).toHaveLength(2);
    expect(
      update.operations.some((operation) => 'createSurface' in operation),
    ).toBe(false);
    expect(update.snapshot).toEqual(initial.snapshot);
    expect(isCoherentCompetitiveWorkspace(update)).toBe(true);
    const corrupted = structuredClone(update);
    corrupted.snapshot.components[1] = {
      id: 'brief',
      component: 'AnalystBrief',
      data: { path: '/private' },
    };
    expect(isCoherentCompetitiveWorkspace(corrupted)).toBe(false);
  });

  it('compares only selected accepted numbers and retains conditions without selecting a conflicting claim', () => {
    const scenario = calculateTargetScenario(comparison, {
      id: 'scenario',
      type: 'scenario',
      title: 'Target',
      attributeCode: 'torque',
      targetValue: 550,
    });
    expect(scenario.status).toBe('OK');
    if (scenario.status !== 'OK') throw new Error('Expected a scenario');
    expect(scenario.items[0]).toMatchObject({
      value: 600,
      delta: 50,
      observationId: fordId,
      qualifiers: { rpm: '1750–2250' },
      evidence: [source],
    });
    expect(scenario.items[1]).toMatchObject({
      value: null,
      delta: null,
      observationId: null,
      knowledgeStatus: 'CONFLICTING',
    });
    expect(
      calculateTargetScenario(comparison, {
        id: 'scenario',
        type: 'scenario',
        title: 'Target',
        attributeCode: 'torque',
      }).status,
    ).toBe('NEEDS_INPUT');
  });
});

describe('authoritative competitive retrieval', () => {
  it('shares one catalog comparison across comparison, gaps and scenario and preserves source payloads', async () => {
    const output = await retrieveCompetitiveWorkspace(plan, {
      uid: 'test',
      surfaceId,
      baseRevision: 0,
    });
    expect(
      vi
        .mocked(catalogRequest)
        .mock.calls.filter(([path]) => path === '/api/comparisons'),
    ).toHaveLength(1);
    expect(output.snapshot.panels[0]?.result).toEqual(comparison);
    expect(output.snapshot.panels[1]?.result).toMatchObject({
      items: [{ knowledgeStatus: 'CONFLICTING', observationCount: 1 }],
    });
    expect(output.snapshot.availableAttributes).toEqual([attribute]);
    expect(isCoherentCompetitiveWorkspace(output)).toBe(true);
  });

  it('renders clarification without ever requesting an unbounded empty-attribute comparison', async () => {
    const input = competitivePlanSchema.parse({
      ...plan,
      context: {
        objective: 'Clarify the benchmark',
        selectedConfigurationIds: [],
        attributes: [],
      },
      panels: [{ id: 'comparison', type: 'comparison', title: 'Compare' }],
    });
    const output = await retrieveCompetitiveWorkspace(input, {
      uid: 'test',
      surfaceId,
      baseRevision: 0,
    });
    expect(output.status).toBe('PARTIAL');
    expect(output.snapshot.panels[0]?.result).toMatchObject({
      status: 'NEEDS_INPUT',
      fields: ['configurations'],
    });
    expect(vi.mocked(catalogRequest).mock.calls.map(([path]) => path)).toEqual([
      '/api/comparison-attributes',
    ]);
  });

  it('uses one multi-search catalog and deduplicates exact evidence queries per invocation', async () => {
    const input = competitivePlanSchema.parse({
      ...plan,
      panels: [
        {
          id: 'select',
          type: 'selection',
          title: 'Candidates',
          searches: [{ q: 'Ranger' }, { q: 'Hilux' }],
        },
        {
          id: 'evidence-one',
          type: 'evidence',
          title: 'Evidence',
          configurationId: fordId,
        },
        {
          id: 'evidence-two',
          type: 'evidence',
          title: 'Related evidence',
          configurationId: fordId,
        },
      ],
    });
    await retrieveCompetitiveWorkspace(input, {
      uid: 'test',
      surfaceId,
      baseRevision: 0,
    });
    expect(searchCatalog).toHaveBeenCalledOnce();
    expect(vi.mocked(searchCatalog).mock.calls[0]?.[0].searches).toEqual([
      { q: 'Ranger', market: 'BR', modelYear: 2026, offset: 0, limit: 6 },
      { q: 'Hilux', market: 'BR', modelYear: 2026, offset: 0, limit: 6 },
    ]);
    expect(retrieveReviewEvidence).toHaveBeenCalledOnce();
    await retrieveCompetitiveWorkspace(input, {
      uid: 'test',
      surfaceId,
      baseRevision: 1,
    });
    expect(retrieveReviewEvidence).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed panel beside the successful authoritative selection', async () => {
    vi.mocked(catalogRequest).mockImplementation(async (path) => {
      if (path === '/api/comparisons') throw new Error('Offline');
      return { items: [attribute] };
    });
    const input = competitivePlanSchema.parse({
      ...plan,
      panels: [
        {
          id: 'select',
          type: 'selection',
          title: 'Candidates',
          searches: [{ q: 'Ranger' }],
        },
        plan.panels[0],
      ],
    });
    const output = await retrieveCompetitiveWorkspace(input, {
      uid: 'test',
      surfaceId,
      baseRevision: 0,
    });
    expect(output.status).toBe('PARTIAL');
    expect(output.snapshot.panels[0]?.result).toEqual(catalog);
    expect(output.snapshot.panels[1]?.result).toMatchObject({
      status: 'ERROR',
      retryable: true,
    });
  });

  it('propagates cancellation even when the existing failure adapter catches a request error', async () => {
    const controller = new AbortController();
    vi.mocked(catalogRequest).mockImplementation(async (path) => {
      if (path === '/api/comparisons') {
        controller.abort();
        throw controller.signal.reason;
      }
      return { items: [attribute] };
    });
    await expect(
      retrieveCompetitiveWorkspace(plan, {
        uid: 'test',
        surfaceId,
        baseRevision: 0,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects a non-Ford baseline and never silently changes the analyst selection', async () => {
    await expect(
      retrieveCompetitiveWorkspace(
        {
          ...plan,
          context: { ...plan.context, baselineConfigurationId: rivalId },
        },
        { uid: 'test', surfaceId, baseRevision: 0 },
      ),
    ).rejects.toThrow('Ford baseline');
  });
});

describe('durable revision chains and typed actions', () => {
  it('normalizes underscore-bearing attribute codes only in the generated panel ID', () => {
    const definition = competitivePlanSchema.parse({
      ...plan,
      context: { ...plan.context, attributes: ['engine_power'] },
      panels: [{ id: 'gaps', type: 'gaps', title: 'Gaps' }],
    });
    const gapPanel = definition.panels[0];
    if (!gapPanel) throw new Error('Missing gap panel');
    const scopedComparison = structuredClone(comparison);
    const row = scopedComparison.rows[0];
    if (!row) throw new Error('Missing comparison row');
    row.attribute.code = 'engine_power';
    const previous = compileCompetitiveWorkspace(
      definition,
      [
        {
          id: gapPanel.id,
          title: gapPanel.title,
          type: 'gaps',
          args: gapPanel,
          result: {
            status: 'OK',
            comparison: scopedComparison,
            items: [
              {
                configurationId: rivalId,
                attributeCode: 'engine_power',
                knowledgeStatus: 'CONFLICTING',
                reason: null,
                observationCount: 1,
              },
            ],
          },
        },
      ],
      [{ ...attribute, code: 'engine_power' }],
      { surfaceId, baseRevision: 0 },
    );
    const verified = validateCompetitiveAction(
      {
        ...action(),
        action: 'investigateGap',
        componentId: 'gaps',
        values: { configurationId: rivalId, attributeCode: 'engine_power' },
      },
      [stored(previous)],
    );
    const focused = applyCompetitiveAction(definition, verified).panels.at(-1);
    expect(focused).toMatchObject({
      type: 'evidence',
      attributeCode: 'engine_power',
    });
    expect(focused?.id).toMatch(/^[a-z][a-z0-9-]{0,39}$/);
  });

  it('binds an investigation to the chosen gap and preserves successful panels despite an adversarial model plan', async () => {
    const previous = result();
    const verified = validateCompetitiveAction(
      {
        ...action(),
        componentId: 'gaps',
        action: 'investigateGap',
        values: { configurationId: rivalId, attributeCode: 'torque' },
      },
      [stored(previous)],
    );
    const unrelated = competitivePlanSchema.parse({
      ...plan,
      context: { objective: 'An unrelated question' },
      panels: [
        {
          id: 'unrelated',
          type: 'evidence',
          title: 'Wrong vehicle',
          configurationId: fordId,
        },
      ],
    });
    const focused = applyCompetitiveAction(unrelated, verified);
    expect(focused.context).toEqual(plan.context);
    expect(focused.panels.slice(0, 3)).toEqual(plan.panels);
    expect(focused.panels.at(-1)).toMatchObject({
      type: 'evidence',
      configurationId: rivalId,
      attributeCode: 'torque',
    });
    vi.mocked(catalogRequest).mockRejectedValue(
      new Error('Catalog is temporarily down'),
    );
    const output = await retrieveCompetitiveWorkspace(focused, {
      uid: 'test',
      surfaceId,
      baseRevision: 1,
      previous,
      action: verified.action,
      actionId: verified.action.actionId,
    });
    expect(output.snapshot.panels.slice(0, 3)).toEqual(
      previous.snapshot.panels,
    );
    expect(catalogRequest).not.toHaveBeenCalled();
    expect(retrieveReviewEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        configurationId: rivalId,
        attributeCode: 'torque',
      }),
      undefined,
    );
  });

  it('retries only the selected failed panel without losing unrelated successful results', async () => {
    const initial = result();
    const definition = competitivePlanSchema.parse({
      ...plan,
      panels: [
        ...plan.panels,
        {
          id: 'evidence',
          type: 'evidence',
          title: 'Review evidence',
          configurationId: fordId,
        },
      ],
    });
    const evidencePanel = definition.panels.at(-1);
    if (!evidencePanel) throw new Error('Missing evidence panel');
    const previous = compileCompetitiveWorkspace(
      definition,
      [
        ...initial.snapshot.panels,
        {
          id: evidencePanel.id,
          type: 'evidence',
          title: evidencePanel.title,
          args: evidencePanel,
          result: {
            status: 'ERROR',
            message: 'Temporary review outage',
            retryable: true,
          },
        },
      ],
      [attribute],
      { surfaceId, baseRevision: 0 },
    );
    const verified = validateCompetitiveAction(
      {
        ...action(),
        action: 'retryPanel',
        componentId: 'evidence',
        values: {},
      },
      [stored(previous)],
    );
    vi.mocked(catalogRequest).mockRejectedValue(
      new Error('Catalog became unavailable'),
    );
    const output = await retrieveCompetitiveWorkspace(
      applyCompetitiveAction(plan, verified),
      {
        uid: 'test',
        surfaceId,
        baseRevision: 1,
        previous,
        action: verified.action,
      },
    );
    expect(output.snapshot.panels.slice(0, 3)).toEqual(initial.snapshot.panels);
    expect(output.snapshot.panels.at(-1)?.result).toEqual(reviews);
    expect(catalogRequest).not.toHaveBeenCalled();
    expect(retrieveReviewEvidence).toHaveBeenCalledOnce();
  });

  it('recalculates a user target from preserved source observations without refetching unchanged evidence', async () => {
    const previous = result();
    const verified = validateCompetitiveAction(
      {
        ...action(),
        componentId: 'scenario',
        action: 'applyScenario',
        values: { attributeCode: 'torque', targetValue: 575 },
      },
      [stored(previous)],
    );
    const updated = await retrieveCompetitiveWorkspace(
      applyCompetitiveAction(plan, verified),
      {
        uid: 'test',
        surfaceId,
        baseRevision: 1,
        previous,
        action: verified.action,
      },
    );
    expect(catalogRequest).not.toHaveBeenCalled();
    expect(updated.snapshot.panels[0]).toEqual(previous.snapshot.panels[0]);
    expect(updated.snapshot.panels[2]?.result).toMatchObject({
      targetValue: 575,
      items: [{ value: 600, delta: 25, evidence: [source] }, { delta: null }],
    });
  });

  it('replays an immutable chain and rejects stale revisions and unknown surfaces', () => {
    const history = [stored(result()), stored(result(1))];
    expect(latestCompetitiveWorkspace(history, surfaceId, 2).revision).toBe(2);
    expect(() => latestCompetitiveWorkspace(history, surfaceId, 1)).toThrow(
      'STALE_REVISION',
    );
    expect(() =>
      latestCompetitiveWorkspace(history, `competitive-${rivalId}`, 1),
    ).toThrow('SURFACE_NOT_FOUND');
  });

  it('rejects two successful children of one base instead of choosing by timestamps', () => {
    const history = [
      stored(result()),
      stored(result(1), 'one'),
      stored(result(1), 'two'),
    ];
    expect(() => competitiveHistory(history, surfaceId)).toThrow(
      'SURFACE_CONFLICT',
    );
  });

  it('deduplicates copies of the same actual invocation but does not treat failed retrieval as a new head', () => {
    const original = stored(result());
    expect(
      competitiveHistory([original, { ...original, id: 'copy' }], surfaceId),
    ).toHaveLength(1);
    const failure = result(1);
    failure.status = 'ERROR';
    expect(
      latestCompetitiveWorkspace([original, stored(failure)], surfaceId, 1)
        .revision,
    ).toBe(1);
  });

  it('accepts only authoritative configuration scope, Ford baseline and supported attributes', () => {
    const rows = [stored(result())];
    expect(validateCompetitiveAction(action(), rows).previous.revision).toBe(1);
    const invalid = [
      { ...action(), values: { ...plan.context, modelYear: 2025 } },
      {
        ...action(),
        values: { ...plan.context, baselineConfigurationId: rivalId },
      },
      {
        ...action(),
        values: { ...plan.context, attributes: ['invented_metric'] },
      },
      { ...action(), execute: 'arbitrary-code' },
    ];
    for (const entry of invalid)
      expect(() => validateCompetitiveAction(entry, rows)).toThrow(
        'INVALID_ACTION',
      );
  });

  it('rejects duplicate action IDs and checks gap membership', () => {
    expect(() =>
      validateCompetitiveAction(action(), [
        stored(result()),
        stored(result(1, rivalId)),
      ]),
    ).toThrow('ACTION_ALREADY_APPLIED');
    const gap = {
      ...action(),
      componentId: 'gaps',
      action: 'investigateGap',
      values: { configurationId: rivalId, attributeCode: 'torque' },
    };
    expect(
      validateCompetitiveAction(gap, [stored(result())]).action.action,
    ).toBe('investigateGap');
    expect(() =>
      validateCompetitiveAction(
        {
          ...gap,
          values: { configurationId: fordId, attributeCode: 'torque' },
        },
        [stored(result())],
      ),
    ).toThrow('INVALID_ACTION');
  });

  it('uses the submitted numeric assumption rather than a model-authored replacement', () => {
    const verified = validateCompetitiveAction(
      {
        ...action(),
        componentId: 'scenario',
        action: 'applyScenario',
        values: { attributeCode: 'torque', targetValue: 575 },
      },
      [stored(result())],
    );
    const updated = applyCompetitiveAction(plan, verified);
    expect(
      updated.panels.find((panel) => panel.id === 'scenario'),
    ).toMatchObject({ targetValue: 575 });
    expect(updated.context).toEqual(plan.context);
  });
});
