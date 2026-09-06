import type { z } from 'zod';

export function parseResult<T>(
  value: unknown,
  schema: z.ZodType<T>,
): T | undefined {
  try {
    const parsed = schema.safeParse(
      typeof value === 'string' ? JSON.parse(value) : value,
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
