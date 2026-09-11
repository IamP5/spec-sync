import type { Message } from '@ag-ui/client';
import { z } from 'zod';

export const RESEARCH_COMPLETION_ACTIVITY = 'specsync.research-completion';

/** Snapshot at delivery; requestId explicitly opens authenticated current research. */
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

export function researchCompletionOf(
  message: Message,
): ResearchCompletion | undefined {
  if (
    message.role !== 'activity' ||
    message.activityType !== RESEARCH_COMPLETION_ACTIVITY
  )
    return undefined;
  const parsed = researchCompletionSchema.safeParse(message.content);
  return parsed.success ? parsed.data : undefined;
}
