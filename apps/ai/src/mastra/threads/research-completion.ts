import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { z } from 'zod';

export const RESEARCH_COMPLETION_PART = 'data-specsync-research-completion';
export const RESEARCH_COMPLETION_ACTIVITY = 'specsync.research-completion';

/** Recorded availability, with an authenticated reference for opening current evidence. */
export const researchCompletionSchema = z
  .object({
    version: z.literal(1),
    requestId: z.string().uuid(),
    workId: z.string().uuid(),
    status: z.enum(['REVIEW', 'PUBLISHED']),
    vehicle: z
      .object({
        brand: z.string().min(1).max(150),
        model: z.string().min(1).max(150),
        modelYear: z.number().int().min(1900).max(2200),
        market: z.literal('BR'),
      })
      .strict(),
    counts: z
      .object({
        configurations: z.number().int().nonnegative(),
        claims: z.number().int().nonnegative(),
        warnings: z.number().int().nonnegative(),
      })
      .strict(),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type ResearchCompletion = z.infer<typeof researchCompletionSchema>;

/** Completion rows are dedicated events; ordinary tool history is never reclassified. */
export function researchCompletionOf(
  message: MastraDBMessage,
): ResearchCompletion | undefined {
  if (message.role !== 'assistant') return undefined;
  const parts = message.content.parts ?? [];
  if (
    parts.some(
      (part) => part.type !== 'text' && part.type !== RESEARCH_COMPLETION_PART,
    )
  )
    return undefined;
  const events = parts.filter((part) => part.type === RESEARCH_COMPLETION_PART);
  if (events.length !== 1) return undefined;
  const part = events[0];
  if (!part || !('data' in part)) return undefined;
  const parsed = researchCompletionSchema.safeParse(part.data);
  return parsed.success ? parsed.data : undefined;
}
