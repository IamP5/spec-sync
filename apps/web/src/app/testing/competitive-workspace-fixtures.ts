import type { Message } from '@ag-ui/client';

import {
  COMPETITIVE_WORKSPACE_CATALOG,
  COMPETITIVE_WORKSPACE_VERSION,
  type CompetitiveComponent,
  type CompetitivePlan,
  type CompetitiveWorkspace,
  type ResolvedCompetitivePanel,
} from '../domains/chat/data/competitive-workspace-contracts';
import { matrix } from './vehicle-fixtures';

export const competitiveSurfaceId =
  'competitive-08e08761-a2e7-5ae5-b2ad-387e93829fb7';
export const competitiveMatrix = {
  ...matrix,
  configurations: [
    matrix.configurations[0],
    {
      ...matrix.configurations[1],
      brand: 'Toyota',
      model: 'Hilux',
      name: 'SRX',
    },
  ],
};

export function competitiveWorkspaceFixture(
  planChanges: Partial<CompetitivePlan> = {},
  revision = 1,
  surfaceId = competitiveSurfaceId,
): CompetitiveWorkspace {
  const plan: CompetitivePlan = {
    title: 'Ford Ranger competitive analysis',
    context: {
      objective: 'Assess equipment gaps against the Hilux in Brazil',
      market: 'BR',
      modelYear: 2026,
      baselineConfigurationId: competitiveMatrix.configurations[0].id,
      selectedConfigurationIds: competitiveMatrix.configurations.map(
        (vehicle) => vehicle.id,
      ),
      attributes: competitiveMatrix.rows.map((row) => row.attribute.code),
      focusAreas: ['equipment'],
    },
    layout: 'analysis',
    panels: [
      {
        id: 'selection',
        title: 'Ford baseline and competitor candidates',
        type: 'selection',
        searches: [
          { q: 'Ford Ranger', limit: 6, offset: 0 },
          { q: 'Toyota Hilux', limit: 6, offset: 0 },
        ],
      },
      {
        id: 'comparison',
        title: 'Selected specification evidence',
        type: 'comparison',
      },
    ],
    ...planChanges,
  };
  const panels: ResolvedCompetitivePanel[] = plan.panels.map((args) => {
    const common = { id: args.id, title: args.title, args };
    switch (args.type) {
      case 'selection':
        return {
          ...common,
          type: 'selection',
          result: {
            ...{
              items: competitiveMatrix.configurations,
              limit: 12,
              offset: 0,
              hasMore: false,
              status: 'OK' as const,
              nextSearches: [],
              notices: [],
            },
          },
        };
      case 'comparison':
        return { ...common, type: 'comparison', result: competitiveMatrix };
      case 'gaps':
        return {
          ...common,
          type: 'gaps',
          result: { status: 'OK', comparison: competitiveMatrix, items: [] },
        };
      case 'scenario':
        return {
          ...common,
          type: 'scenario',
          result: {
            status: 'NEEDS_INPUT',
            message: 'Enter an explicit target.',
            fields: ['targetValue'],
          },
        };
      case 'evidence':
        return {
          ...common,
          type: 'evidence',
          result: {
            kind: 'reviews',
            status: 'EMPTY',
            message: 'No matching review evidence.',
            projectionVersion: null,
            items: [],
          },
        };
      case 'research':
        return {
          ...common,
          type: 'research',
          result: {
            status: 'ERROR',
            message: 'Research service unavailable.',
            retryable: true,
          },
        };
    }
  });
  return compileFixture(plan, panels, revision, surfaceId);
}
export function reviseCompetitiveWorkspace(
  previous: CompetitiveWorkspace,
  planChanges: Partial<CompetitivePlan> = {},
  panels?: ResolvedCompetitivePanel[],
): CompetitiveWorkspace {
  return compileFixture(
    { ...previous.snapshot.plan, ...planChanges },
    panels ?? previous.snapshot.panels,
    previous.revision + 1,
    previous.surfaceId,
    previous.snapshot.availableAttributes,
  );
}
function compileFixture(
  plan: CompetitivePlan,
  panels: ResolvedCompetitivePanel[],
  revision: number,
  surfaceId: string,
  availableAttributes = competitiveMatrix.rows.map((row) => row.attribute),
): CompetitiveWorkspace {
  const names = {
    selection: 'VehicleSelection',
    comparison: 'VehicleComparison',
    evidence: 'VehicleEvidence',
    gaps: 'EvidenceGaps',
    research: 'VehicleResearch',
    scenario: 'TargetScenario',
  } as const;
  const components: CompetitiveComponent[] = [
    {
      id: 'root',
      component: plan.layout === 'stack' ? 'Column' : 'Row',
      children: ['brief', ...plan.panels.map((panel) => panel.id)],
    },
    { id: 'brief', component: 'AnalystBrief', data: { path: '/brief' } },
    ...panels.map((panel) => ({
      id: panel.id,
      component: names[panel.type],
      data: { path: `/panels/${panel.id}` },
    })),
  ];
  const failed = panels.filter(
    (panel) =>
      'status' in panel.result &&
      ['ERROR', 'UNAVAILABLE'].includes(panel.result.status),
  );
  const partial = panels.some(
    (panel) =>
      'status' in panel.result &&
      ['NEEDS_INPUT', 'PARTIAL'].includes(panel.result.status),
  );
  return {
    schemaVersion: COMPETITIVE_WORKSPACE_VERSION,
    status:
      failed.length === panels.length
        ? 'ERROR'
        : failed.length || partial
          ? 'PARTIAL'
          : 'OK',
    surfaceId,
    revision,
    baseRevision: revision - 1,
    snapshot: { plan, panels, components, availableAttributes },
    operations: [
      ...(revision === 1
        ? [
            {
              version: 'v0.9' as const,
              createSurface: {
                surfaceId,
                catalogId:
                  COMPETITIVE_WORKSPACE_CATALOG as typeof COMPETITIVE_WORKSPACE_CATALOG,
              },
            },
          ]
        : []),
      { version: 'v0.9', updateComponents: { surfaceId, components } },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId,
          path: '/',
          value: {
            brief: plan.context,
            availableAttributes,
            panels: Object.fromEntries(
              panels.map((panel) => [panel.id, panel]),
            ),
          },
        },
      },
    ],
  };
}
export function competitiveWorkspaceMessages(
  workspace: unknown,
  callId = 'workspace-call',
): Message[] {
  return [
    {
      id: `assistant-${callId}`,
      role: 'assistant',
      toolCalls: [
        {
          id: callId,
          type: 'function',
          function: { name: 'renderCompetitiveWorkspace', arguments: '{}' },
        },
      ],
    },
    {
      id: `result-${callId}`,
      role: 'tool',
      toolCallId: callId,
      content: JSON.stringify(workspace),
    },
  ];
}
