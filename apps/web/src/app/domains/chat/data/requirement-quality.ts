import { z } from 'zod';

/**
 * Server tool of the chat agent (`apps/ai`, `checkRequirementQuality`). The
 * browser only renders its call: these schemas mirror the tool's input and
 * output so the card can validate what streams in.
 */
export const REQUIREMENT_QUALITY_TOOL = 'checkRequirementQuality';

export const requirementQualityArgsSchema = z.object({
  requirement: z.string().optional(),
});

export const requirementQualityFindingSchema = z.object({
  rule: z.string(),
  severity: z.enum(['error', 'warning']),
  message: z.string(),
  excerpt: z.string().optional(),
});

export const requirementQualityResultSchema = z.object({
  requirement: z.string(),
  score: z.number(),
  verdict: z.enum(['good', 'needs-work', 'poor']),
  findings: z.array(requirementQualityFindingSchema),
});

export type RequirementQualityArgs = z.infer<
  typeof requirementQualityArgsSchema
>;
export type RequirementQualityFinding = z.infer<
  typeof requirementQualityFindingSchema
>;
export type RequirementQualityResult = z.infer<
  typeof requirementQualityResultSchema
>;

/**
 * Parses a tool result as the AG-UI client delivers it: either the object
 * itself or its JSON text. Returns `undefined` for anything else.
 */
export function parseRequirementQualityResult(
  result: unknown,
): RequirementQualityResult | undefined {
  const candidate = typeof result === 'string' ? tryParseJson(result) : result;
  const parsed = requirementQualityResultSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
