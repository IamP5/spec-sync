import { z } from 'zod';

import {
  attributeSchema,
  catalogPageSchema,
  comparisonSchema,
  evidenceSchema,
  failureSchema,
  researchSummarySchema,
} from '../../vehicles/api/contracts';
import {
  type AnalystContext,
  analystContextSchema,
  competitiveAttributeCodeSchema,
  competitiveSurfaceIdSchema,
} from './competitive-workspace-actions';
import { reviewEvidenceResultSchema } from './knowledge-contracts';
export const COMPETITIVE_WORKSPACE_CATALOG =
  'urn:specsync:a2ui:competitive-analysis:1';
export const COMPETITIVE_WORKSPACE_VERSION =
  'specsync.competitive-workspace.v1';
const title = z.string().trim().min(1).max(120);
const panelId = z.string().regex(/^(?!root$|brief$)[a-z][a-z0-9-]{0,39}$/);
const uuid = z.string().uuid();
const search = z
  .object({
    q: z.string().max(100),
    market: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    modelYear: z.number().int().min(1900).max(2200).optional(),
    limit: z.number().int().min(1).max(8),
    offset: z.literal(0),
  })
  .strict();
const common = { id: panelId, title };
export const competitivePanelSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...common,
      type: z.literal('selection'),
      searches: z.array(search).min(1).max(5),
    })
    .strict(),
  z.object({ ...common, type: z.literal('comparison') }).strict(),
  z.object({ ...common, type: z.literal('gaps') }).strict(),
  z
    .object({
      ...common,
      type: z.literal('evidence'),
      configurationId: uuid,
      q: z.string().max(200).default(''),
      attributeCode: competitiveAttributeCodeSchema.optional(),
      limit: z.number().int().min(1).max(6).default(4),
    })
    .strict(),
  z
    .object({ ...common, type: z.literal('research'), requestId: uuid })
    .strict(),
  z
    .object({
      ...common,
      type: z.literal('scenario'),
      attributeCode: competitiveAttributeCodeSchema,
      targetValue: z.number().finite().optional(),
    })
    .strict(),
]);
const planFields = {
  title,
  context: analystContextSchema,
  layout: z.enum(['stack', 'analysis']).default('analysis'),
  panels: z.array(competitivePanelSchema).min(1).max(6),
};
function validatePlan(
  plan: { context: AnalystContext; panels: CompetitivePanel[] },
  ctx: z.RefinementCtx,
) {
  if (new Set(plan.panels.map((panel) => panel.id)).size !== plan.panels.length)
    ctx.addIssue({
      code: 'custom',
      message: 'Panel IDs must be unique.',
      path: ['panels'],
    });
  if (plan.panels.filter((panel) => panel.type === 'selection').length > 1)
    ctx.addIssue({
      code: 'custom',
      message: 'Use one selection catalog with all searches.',
      path: ['panels'],
    });
  if (
    new Set(plan.context.selectedConfigurationIds).size !==
    plan.context.selectedConfigurationIds.length
  )
    ctx.addIssue({
      code: 'custom',
      message: 'Selected configurations must be unique.',
      path: ['context', 'selectedConfigurationIds'],
    });
  if (
    plan.context.baselineConfigurationId &&
    !plan.context.selectedConfigurationIds.includes(
      plan.context.baselineConfigurationId,
    )
  )
    ctx.addIssue({
      code: 'custom',
      message: 'The baseline must belong to the selected configurations.',
      path: ['context', 'baselineConfigurationId'],
    });
}
export const competitivePlanSchema = z
  .object(planFields)
  .strict()
  .superRefine(validatePlan);
export const competitiveWorkspaceInputSchema = z
  .object({
    ...planFields,
    target: z
      .object({
        surfaceId: competitiveSurfaceIdSchema,
        baseRevision: z.number().int().min(1),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine(validatePlan);

export const analystNeedsInputSchema = z
  .object({
    status: z.literal('NEEDS_INPUT'),
    message: z.string(),
    fields: z.array(
      z.enum([
        'market',
        'modelYear',
        'configurations',
        'attributes',
        'targetValue',
      ]),
    ),
  })
  .strict();
export const evidenceGapsSchema = z
  .object({
    status: z.literal('OK'),
    comparison: comparisonSchema,
    items: z
      .array(
        z
          .object({
            configurationId: uuid,
            attributeCode: competitiveAttributeCodeSchema,
            knowledgeStatus: z.enum(['NOT_REPORTED', 'CONFLICTING']),
            reason: z.string().nullable(),
            observationCount: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .max(60),
  })
  .strict();
export const targetScenarioSchema = z
  .object({
    status: z.literal('OK'),
    assumption: z.literal('USER_DEFINED_TARGET'),
    attribute: attributeSchema,
    targetValue: z.number().finite(),
    items: z
      .array(
        z
          .object({
            configurationId: uuid,
            knowledgeStatus: z.enum(['KNOWN', 'NOT_REPORTED', 'CONFLICTING']),
            observationId: uuid.nullable(),
            value: z.number().finite().nullable(),
            delta: z.number().finite().nullable(),
            qualifiers: z.record(z.unknown()),
            evidence: z.array(evidenceSchema),
            reason: z.string().nullable(),
          })
          .strict(),
      )
      .max(5),
  })
  .strict();
const resolvedCommon = { ...common, args: competitivePanelSchema };
export const resolvedCompetitivePanelSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...resolvedCommon,
      type: z.literal('selection'),
      result: z.union([
        catalogPageSchema
          .required({ status: true, notices: true, nextSearches: true })
          .strict(),
        failureSchema.strict(),
      ]),
    })
    .strict(),
  z
    .object({
      ...resolvedCommon,
      type: z.literal('comparison'),
      result: z.union([
        comparisonSchema,
        analystNeedsInputSchema,
        failureSchema,
      ]),
    })
    .strict(),
  z
    .object({
      ...resolvedCommon,
      type: z.literal('gaps'),
      result: z.union([
        evidenceGapsSchema,
        analystNeedsInputSchema,
        failureSchema,
      ]),
    })
    .strict(),
  z
    .object({
      ...resolvedCommon,
      type: z.literal('evidence'),
      result: z.union([
        reviewEvidenceResultSchema,
        analystNeedsInputSchema,
        failureSchema,
      ]),
    })
    .strict(),
  z
    .object({
      ...resolvedCommon,
      type: z.literal('research'),
      result: z.union([researchSummarySchema, failureSchema]),
    })
    .strict(),
  z
    .object({
      ...resolvedCommon,
      type: z.literal('scenario'),
      result: z.union([
        targetScenarioSchema,
        analystNeedsInputSchema,
        failureSchema,
      ]),
    })
    .strict(),
]);
export const competitiveComponentSchema = z.union([
  z
    .object({
      id: z.literal('root'),
      component: z.enum(['Column', 'Row']),
      children: z.array(z.string()).min(2).max(7),
    })
    .strict(),
  z
    .object({
      id: z.string(),
      component: z.enum([
        'AnalystBrief',
        'VehicleSelection',
        'VehicleComparison',
        'VehicleEvidence',
        'EvidenceGaps',
        'VehicleResearch',
        'TargetScenario',
      ]),
      data: z.object({ path: z.string() }).strict(),
    })
    .strict(),
]);
const modelValueSchema = z
  .object({
    brief: analystContextSchema,
    availableAttributes: z.array(attributeSchema).max(50),
    panels: z.record(resolvedCompetitivePanelSchema),
  })
  .strict();
const surfaceUpdate = { surfaceId: competitiveSurfaceIdSchema };
export const competitiveOperationSchema = z.union([
  z
    .object({
      version: z.literal('v0.9'),
      createSurface: z
        .object({
          ...surfaceUpdate,
          catalogId: z.literal(COMPETITIVE_WORKSPACE_CATALOG),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      version: z.literal('v0.9'),
      updateComponents: z
        .object({
          ...surfaceUpdate,
          components: z.array(competitiveComponentSchema).min(3).max(8),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      version: z.literal('v0.9'),
      updateDataModel: z
        .object({
          ...surfaceUpdate,
          path: z.literal('/'),
          value: modelValueSchema,
        })
        .strict(),
    })
    .strict(),
]);
export const competitiveSnapshotSchema = z
  .object({
    plan: competitivePlanSchema,
    panels: z.array(resolvedCompetitivePanelSchema).min(1).max(6),
    availableAttributes: z.array(attributeSchema).max(50),
    components: z.array(competitiveComponentSchema).min(3).max(8),
  })
  .strict();
const competitiveWorkspaceShape = z
  .object({
    schemaVersion: z.literal(COMPETITIVE_WORKSPACE_VERSION),
    status: z.enum(['OK', 'PARTIAL', 'ERROR']),
    surfaceId: competitiveSurfaceIdSchema,
    revision: z.number().int().min(1),
    baseRevision: z.number().int().min(0),
    actionId: uuid.optional(),
    snapshot: competitiveSnapshotSchema,
    operations: z.array(competitiveOperationSchema).min(2).max(3),
  })
  .strict();
export const competitiveRejectionSchema = z
  .object({
    status: z.literal('REJECTED'),
    code: z.enum([
      'STALE_REVISION',
      'SURFACE_NOT_FOUND',
      'SURFACE_CONFLICT',
      'INVALID_ACTION',
      'ACTION_ALREADY_APPLIED',
    ]),
    message: z.string(),
    surfaceId: competitiveSurfaceIdSchema.optional(),
    requestedRevision: z.number().int().min(1).optional(),
    latestRevision: z.number().int().min(1).optional(),
  })
  .strict();
export type CompetitivePanel = z.infer<typeof competitivePanelSchema>;
export type CompetitivePlan = z.infer<typeof competitivePlanSchema>;
export type CompetitiveWorkspaceInput = z.infer<
  typeof competitiveWorkspaceInputSchema
>;
export type CompetitiveWorkspace = z.infer<typeof competitiveWorkspaceShape>;
export type CompetitiveSnapshot = z.infer<typeof competitiveSnapshotSchema>;
export type CompetitiveComponent = z.infer<typeof competitiveComponentSchema>;
export type ResolvedCompetitivePanel = z.infer<
  typeof resolvedCompetitivePanelSchema
>;
export type CompetitiveRejection = z.infer<typeof competitiveRejectionSchema>;

export const competitiveWorkspaceSchema = competitiveWorkspaceShape.superRefine(
  (output, ctx) => {
    const { plan, panels, availableAttributes } = output.snapshot;
    const names = {
      selection: 'VehicleSelection',
      comparison: 'VehicleComparison',
      evidence: 'VehicleEvidence',
      gaps: 'EvidenceGaps',
      research: 'VehicleResearch',
      scenario: 'TargetScenario',
    } as const;
    const components = [
      {
        id: 'root',
        component: plan.layout === 'stack' ? 'Column' : 'Row',
        children: ['brief', ...plan.panels.map((p) => p.id)],
      },
      { id: 'brief', component: 'AnalystBrief', data: { path: '/brief' } },
      ...plan.panels.map((p) => ({
        id: p.id,
        component: names[p.type],
        data: { path: `/panels/${p.id}` },
      })),
    ];
    const failed = panels.filter(
      ({ result }) =>
        'status' in result && ['ERROR', 'UNAVAILABLE'].includes(result.status),
    );
    const incomplete = panels.some(
      ({ result }) =>
        'status' in result &&
        ['NEEDS_INPUT', 'PARTIAL'].includes(result.status),
    );
    const status =
      failed.length === panels.length
        ? 'ERROR'
        : failed.length || incomplete
          ? 'PARTIAL'
          : 'OK';
    const operations = [
      ...(output.baseRevision === 0
        ? [
            {
              version: 'v0.9',
              createSurface: {
                surfaceId: output.surfaceId,
                catalogId: COMPETITIVE_WORKSPACE_CATALOG,
              },
            },
          ]
        : []),
      {
        version: 'v0.9',
        updateComponents: { surfaceId: output.surfaceId, components },
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: output.surfaceId,
          path: '/',
          value: {
            brief: plan.context,
            availableAttributes,
            panels: Object.fromEntries(panels.map((p) => [p.id, p])),
          },
        },
      },
    ];
    if (
      output.revision !== output.baseRevision + 1 ||
      output.status !== status ||
      !sameWorkspaceJson(output.operations, operations) ||
      !sameWorkspaceJson(output.snapshot.components, components) ||
      panels.length !== plan.panels.length ||
      !panels.every((panel, index) => {
        const def = plan.panels[index];
        return (
          def?.id === panel.id &&
          def.type === panel.type &&
          def.title === panel.title &&
          sameWorkspaceJson(def, panel.args)
        );
      })
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Workspace revision, graph, bindings and resolved snapshot must describe the same surface.',
      });
  },
);
/** JSON object key order has no bearing on the declared contract. */
export function sameWorkspaceJson(left: unknown, right: unknown): boolean {
  return canonical(left) === canonical(right);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}
export type CompetitiveAttribute = z.infer<typeof attributeSchema>;
export type EvidenceGaps = z.infer<typeof evidenceGapsSchema>;
export type TargetScenario = z.infer<typeof targetScenarioSchema>;
