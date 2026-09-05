import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const REQUIREMENT_QUALITY_TOOL_ID = 'checkRequirementQuality';

/**
 * Rules a requirement statement is checked against. They follow the usual
 * writing guidance for testable requirements (ISO/IEC/IEEE 29148, INCOSE):
 * one need per statement, a modal verb, no vague or open-ended wording.
 */
export const requirementQualityRuleSchema = z.enum([
  'ambiguous-term',
  'escape-clause',
  'open-ended',
  'compound',
  'no-modal-verb',
  'too-long',
]);

export const requirementQualityFindingSchema = z.object({
  rule: requirementQualityRuleSchema,
  severity: z.enum(['error', 'warning']),
  message: z.string(),
  excerpt: z.string().optional(),
});

export const requirementQualityInputSchema = z.object({
  requirement: z
    .string()
    .min(1)
    .describe('The requirement statement to check, quoted verbatim.'),
});

export const requirementQualityOutputSchema = z.object({
  requirement: z.string(),
  score: z.number().int().min(0).max(100),
  verdict: z.enum(['good', 'needs-work', 'poor']),
  findings: z.array(requirementQualityFindingSchema),
});

export type RequirementQualityFinding = z.infer<
  typeof requirementQualityFindingSchema
>;
export type RequirementQualityResult = z.infer<
  typeof requirementQualityOutputSchema
>;

const AMBIGUOUS_TERMS = [
  'fast',
  'quick',
  'quickly',
  'easy',
  'easily',
  'user-friendly',
  'intuitive',
  'efficient',
  'efficiently',
  'robust',
  'reliable',
  'adequate',
  'appropriate',
  'reasonable',
  'sufficient',
  'seamless',
  'seamlessly',
  'flexible',
  'scalable',
  'timely',
  'minimal',
  'optimal',
  'best',
  'several',
  'some',
  'many',
  'few',
  'approximately',
  'about',
  'normally',
  'usually',
  'often',
  'mostly',
];

const ESCAPE_CLAUSES = [
  'if possible',
  'where possible',
  'where appropriate',
  'as appropriate',
  'as applicable',
  'as needed',
  'when necessary',
  'if practical',
  'to the extent possible',
];

const OPEN_ENDED_PHRASES = [
  'etc',
  'and so on',
  'and/or',
  'including but not limited to',
];

const MODAL_VERBS = /\b(shall|must|should|will)\b/i;
const MAX_WORDS = 50;
const ERROR_PENALTY = 20;
const WARNING_PENALTY = 10;

/**
 * Deterministic quality check of one requirement statement. It runs without
 * a model, so the agent gets the same verdict for the same sentence every
 * time and the browser can render the findings as a widget.
 */
export function checkRequirementQuality(
  requirement: string,
): RequirementQualityResult {
  const text = requirement.trim();
  const lower = text.toLowerCase();
  const findings: RequirementQualityFinding[] = [];

  for (const term of AMBIGUOUS_TERMS) {
    if (containsWord(lower, term)) {
      findings.push({
        rule: 'ambiguous-term',
        severity: 'warning',
        message: `"${term}" is not measurable. Replace it with a number, a threshold or a reference.`,
        excerpt: term,
      });
    }
  }

  for (const clause of ESCAPE_CLAUSES) {
    if (lower.includes(clause)) {
      findings.push({
        rule: 'escape-clause',
        severity: 'error',
        message: `"${clause}" makes the requirement optional. State the condition explicitly or drop it.`,
        excerpt: clause,
      });
    }
  }

  for (const phrase of OPEN_ENDED_PHRASES) {
    if (containsWord(lower, phrase)) {
      findings.push({
        rule: 'open-ended',
        severity: 'error',
        message: `"${phrase}" leaves the scope open. List every case the requirement covers.`,
        excerpt: phrase,
      });
    }
  }

  if (!MODAL_VERBS.test(text)) {
    findings.push({
      rule: 'no-modal-verb',
      severity: 'error',
      message:
        'No "shall", "must", "should" or "will". Make the obligation explicit.',
    });
  }

  const modalCount = text.match(/\b(shall|must)\b/gi)?.length ?? 0;
  const conjunctions = lower.match(/\b(and|or)\b/g)?.length ?? 0;
  if (modalCount > 1 || conjunctions >= 3) {
    findings.push({
      rule: 'compound',
      severity: 'warning',
      message:
        'The statement bundles several needs. Split it so each can be tested on its own.',
    });
  }

  const words = text.split(/\s+/).filter(Boolean).length;
  if (words > MAX_WORDS) {
    findings.push({
      rule: 'too-long',
      severity: 'warning',
      message: `${words} words is hard to verify at once. Aim for ${MAX_WORDS} or fewer.`,
    });
  }

  const penalty = findings.reduce(
    (sum, finding) =>
      sum + (finding.severity === 'error' ? ERROR_PENALTY : WARNING_PENALTY),
    0,
  );
  const score = Math.max(0, 100 - penalty);

  return { requirement: text, score, verdict: toVerdict(score), findings };
}

function containsWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return new RegExp(`(^|[^a-z-])${escaped}(?![a-z-])`).test(text);
}

function toVerdict(score: number): RequirementQualityResult['verdict'] {
  if (score >= 80) {
    return 'good';
  }
  return score >= 50 ? 'needs-work' : 'poor';
}

/**
 * Server tool of the chat agent. The result streams to the browser as an
 * AG-UI tool call, where the chat feature renders it as a card instead of
 * plain text.
 */
export const requirementQualityTool = createTool({
  id: REQUIREMENT_QUALITY_TOOL_ID,
  description:
    'Checks one requirement statement for testability problems: vague terms, ' +
    'escape clauses, open-ended lists, missing modal verb, compound statements. ' +
    'Returns a score from 0 to 100 and the findings. Call it once per requirement.',
  inputSchema: requirementQualityInputSchema,
  outputSchema: requirementQualityOutputSchema,
  execute: async ({ requirement }) => checkRequirementQuality(requirement),
});
