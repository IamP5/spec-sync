import type { z } from 'zod';

import type { attributeSchema } from '../catalog/contracts';
import {
  COMPETITIVE_WORKSPACE_CATALOG,
  COMPETITIVE_WORKSPACE_VERSION,
  type CompetitiveComponent,
  type CompetitivePlan,
  type CompetitiveWorkspaceOutput,
  type ResolvedCompetitivePanel,
} from './competitive-contracts';

const components = {
  selection: 'VehicleSelection',
  comparison: 'VehicleComparison',
  evidence: 'VehicleEvidence',
  gaps: 'EvidenceGaps',
  research: 'VehicleResearch',
  scenario: 'TargetScenario',
} as const;

export function competitiveComponents(
  plan: CompetitivePlan,
): CompetitiveComponent[] {
  return [
    {
      id: 'root',
      component: plan.layout === 'stack' ? 'Column' : 'Row',
      children: ['brief', ...plan.panels.map((panel) => panel.id)],
    },
    { id: 'brief', component: 'AnalystBrief', data: { path: '/brief' } },
    ...plan.panels.map((panel) => ({
      id: panel.id,
      component: components[panel.type],
      data: { path: `/panels/${panel.id}` },
    })),
  ];
}

/** Each revision retains a full replay snapshot while live operations update its existing surface. */
export function compileCompetitiveWorkspace(
  plan: CompetitivePlan,
  panels: ResolvedCompetitivePanel[],
  availableAttributes: z.infer<typeof attributeSchema>[],
  target: { surfaceId: string; baseRevision: number; actionId?: string },
): CompetitiveWorkspaceOutput {
  const components = competitiveComponents(plan);
  const failures = panels.filter(
    ({ result }) =>
      'status' in result && ['ERROR', 'UNAVAILABLE'].includes(result.status),
  );
  const incomplete = panels.some(
    ({ result }) =>
      'status' in result && ['NEEDS_INPUT', 'PARTIAL'].includes(result.status),
  );
  return {
    schemaVersion: COMPETITIVE_WORKSPACE_VERSION,
    status:
      failures.length === panels.length
        ? 'ERROR'
        : failures.length || incomplete
          ? 'PARTIAL'
          : 'OK',
    surfaceId: target.surfaceId,
    baseRevision: target.baseRevision,
    revision: target.baseRevision + 1,
    ...(target.actionId ? { actionId: target.actionId } : {}),
    snapshot: { plan, panels, availableAttributes, components },
    operations: [
      ...(target.baseRevision === 0
        ? [
            {
              version: 'v0.9',
              createSurface: {
                surfaceId: target.surfaceId,
                catalogId: COMPETITIVE_WORKSPACE_CATALOG,
              },
            } as const,
          ]
        : []),
      {
        version: 'v0.9',
        updateComponents: { surfaceId: target.surfaceId, components },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: target.surfaceId,
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

/** Validate graph, bindings, revision and snapshot equivalence, not merely JSON field types. */
export function isCoherentCompetitiveWorkspace(
  output: CompetitiveWorkspaceOutput,
): boolean {
  const expected = compileCompetitiveWorkspace(
    output.snapshot.plan,
    output.snapshot.panels,
    output.snapshot.availableAttributes,
    output,
  );
  if (output.snapshot.panels.length !== output.snapshot.plan.panels.length)
    return false;
  if (
    !output.snapshot.panels.every((panel, index) => {
      const definition = output.snapshot.plan.panels[index];
      return (
        definition?.id === panel.id &&
        definition.type === panel.type &&
        definition.title === panel.title &&
        sameJson(definition, panel.args)
      );
    })
  )
    return false;
  return sameJson(output, expected);
}

export function sameJson(left: unknown, right: unknown): boolean {
  return canonical(left) === canonical(right);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}
