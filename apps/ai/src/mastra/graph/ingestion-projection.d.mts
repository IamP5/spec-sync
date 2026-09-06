import { z } from 'zod';
export const projectionInput: z.ZodType<{
  revision: number;
  snapshot: Record<string, Record<string, unknown>[]>;
}>;
export function projectIngestion(
  input: z.infer<typeof projectionInput>,
): Promise<void>;
