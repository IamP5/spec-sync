import { z } from 'zod';

/**
 * Frontend tool the chat page advertises to the agent on every run. The
 * agent calls it to present a requirement it wrote; the browser executes it
 * (nothing to do server-side) and renders the draft as a card. Part of the
 * contract with `apps/ai` (`PRESENT_REQUIREMENT_DRAFT_TOOL`).
 */
export const PRESENT_REQUIREMENT_DRAFT_TOOL = 'presentRequirementDraft';

export const requirementDraftSchema = z.object({
  title: z.string().describe('Short name of the requirement, a few words.'),
  statement: z
    .string()
    .describe('The requirement itself, one testable sentence with "shall".'),
  rationale: z
    .string()
    .optional()
    .describe('Why the requirement exists, one sentence.'),
  acceptanceCriteria: z
    .array(z.string())
    .optional()
    .describe('How the requirement is verified, one criterion per entry.'),
});

export type RequirementDraft = z.infer<typeof requirementDraftSchema>;

/**
 * The draft as plain text, for the clipboard. Accepts a partial draft because
 * the arguments stream in while the agent is still writing them.
 */
export function formatRequirementDraft(
  draft: Partial<RequirementDraft>,
): string {
  const lines = [`# ${draft.title ?? ''}`, '', draft.statement ?? ''];
  if (draft.rationale) {
    lines.push('', `Rationale: ${draft.rationale}`);
  }
  if (draft.acceptanceCriteria?.length) {
    lines.push('', 'Acceptance criteria:');
    lines.push(...draft.acceptanceCriteria.map((item) => `- ${item}`));
  }
  return lines.join('\n');
}
