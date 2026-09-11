import { z } from 'zod';

import {
  catalogSearchInputSchema,
  catalogSearchOutputSchema,
} from '../catalog/catalog-search';
import {
  attributeSchema,
  comparisonSchema,
  evidenceSchema,
  failureSchema,
} from '../catalog/contracts';
import { reviewEvidenceResultSchema } from '../catalog/knowledge-results';
import { researchSummarySchema } from '../research/contracts';

export const COMPETITIVE_WORKSPACE_CATALOG =
  'urn:specsync:a2ui:competitive-analysis:1';
export const COMPETITIVE_WORKSPACE_VERSION =
  'specsync.competitive-workspace.v1';
export const competitiveSurfaceIdSchema = z
  .string()
  .regex(
    /^competitive-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
export const competitiveAttributeCodeSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,79}$/);
const title = z.string().trim().min(1).max(120);
const panelId = z.string().regex(/^(?!root$|brief$)[a-z][a-z0-9-]{0,39}$/);
const uuid = z.string().uuid();
export const analystContextSchema = z
  .object({
    objective: z.string().trim().min(1).max(500),
    market: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    modelYear: z.number().int().min(1900).max(2200).optional(),
    baselineConfigurationId: uuid.optional(),
    selectedConfigurationIds: z.array(uuid).max(5).default([]),
    attributes: z.array(competitiveAttributeCodeSchema).max(12).default([]),
    focusAreas: z
      .array(z.enum(['powertrain', 'performance', 'dimensions', 'equipment']))
      .max(4)
      .default([]),
  })
  .strict();
const search = catalogSearchInputSchema.shape.searches.element
  .extend({
    limit: z.number().int().min(1).max(8).default(6),
    offset: z.literal(0).default(0),
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
      result: catalogSearchOutputSchema,
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
export const competitiveWorkspaceOutputSchema = z
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
const actionCommon = {
  version: z.literal(1),
  actionId: uuid,
  surfaceId: competitiveSurfaceIdSchema,
  expectedRevision: z.number().int().min(1),
  componentId: z.string().min(1).max(40),
};
export const competitiveActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      ...actionCommon,
      componentId: z.literal('brief'),
      action: z.literal('applyBrief'),
      values: analystContextSchema,
    })
    .strict(),
  z
    .object({
      ...actionCommon,
      action: z.literal('investigateGap'),
      values: z
        .object({
          configurationId: uuid,
          attributeCode: competitiveAttributeCodeSchema,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...actionCommon,
      action: z.literal('applyScenario'),
      values: z
        .object({
          attributeCode: competitiveAttributeCodeSchema,
          targetValue: z.number().finite(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...actionCommon,
      action: z.literal('retryPanel'),
      values: z.object({}).strict(),
    })
    .strict(),
]);

export type AnalystContext = z.infer<typeof analystContextSchema>;
export type CompetitivePanel = z.infer<typeof competitivePanelSchema>;
export type CompetitivePlan = z.infer<typeof competitivePlanSchema>;
export type CompetitiveWorkspaceInput = z.infer<
  typeof competitiveWorkspaceInputSchema
>;
export type CompetitiveWorkspaceOutput = z.infer<
  typeof competitiveWorkspaceOutputSchema
>;
export type CompetitiveSnapshot = z.infer<typeof competitiveSnapshotSchema>;
export type CompetitiveComponent = z.infer<typeof competitiveComponentSchema>;
export type ResolvedCompetitivePanel = z.infer<
  typeof resolvedCompetitivePanelSchema
>;
export type CompetitiveAction = z.infer<typeof competitiveActionSchema>;
export type CompetitiveRejection = z.infer<typeof competitiveRejectionSchema>;
