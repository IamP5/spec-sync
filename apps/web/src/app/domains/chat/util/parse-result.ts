import type { z } from 'zod';

export function parseResult<Schema extends z.ZodTypeAny>(
  value: unknown,
  schema: Schema,
): z.output<Schema> | undefined {
  try {
    const parsed = schema.safeParse(
      typeof value === 'string' ? JSON.parse(value) : value,
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
