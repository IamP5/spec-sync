import { z } from 'zod';

export const competitiveSurfaceIdSchema = z
  .string()
  .regex(
    /^competitive-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
export const competitiveAttributeCodeSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,79}$/);
export const competitivePanelIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,39}$/);
export const analystFocusAreaSchema = z.enum([
  'powertrain',
  'performance',
  'dimensions',
  'equipment',
]);
export const analystContextSchema = z
  .object({
    objective: z.string().trim().min(1).max(500),
    market: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    modelYear: z.number().int().min(1900).max(2200).optional(),
    baselineConfigurationId: z.string().uuid().optional(),
    selectedConfigurationIds: z.array(z.string().uuid()).max(5),
    attributes: z.array(competitiveAttributeCodeSchema).max(12),
    focusAreas: z.array(analystFocusAreaSchema).max(4),
  })
  .strict();

const actionBase = {
  version: z.literal(1),
  actionId: z.string().uuid(),
  surfaceId: competitiveSurfaceIdSchema,
  expectedRevision: z.number().int().min(1),
  componentId: competitivePanelIdSchema,
};

export const workspaceActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      ...actionBase,
      componentId: z.literal('brief'),
      action: z.literal('applyBrief'),
      values: analystContextSchema,
    })
    .strict(),
  z
    .object({
      ...actionBase,
      action: z.literal('investigateGap'),
      values: z
        .object({
          configurationId: z.string().uuid(),
          attributeCode: competitiveAttributeCodeSchema,
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...actionBase,
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
      ...actionBase,
      action: z.literal('retryPanel'),
      values: z.object({}).strict(),
    })
    .strict(),
]);

export type AnalystContext = z.infer<typeof analystContextSchema>;
export type AnalystFocusArea = z.infer<typeof analystFocusAreaSchema>;
export type WorkspaceAction = z.infer<typeof workspaceActionSchema>;
export const WORKSPACE_ACTION_METADATA_KEY = 'specsyncWorkspaceAction';

/** A readable record accompanies the typed action; no intent is recovered from it. */
export function workspaceActionSummary(action: WorkspaceAction): string {
  switch (action.action) {
    case 'applyBrief':
      return `Update the competitive analysis brief: ${action.values.objective}`;
    case 'investigateGap':
      return `Investigate the evidence gap for ${action.values.attributeCode}, configuration ${action.values.configurationId}.`;
    case 'applyScenario':
      return `Recalculate the ${action.values.attributeCode} scenario against the analyst target ${action.values.targetValue}.`;
    case 'retryPanel':
      return `Retry the ${action.componentId} panel in this competitive analysis.`;
  }
}
