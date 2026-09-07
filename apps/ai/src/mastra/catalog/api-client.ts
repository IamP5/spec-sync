import { z } from 'zod';

import { cloudRunHeaders } from './cloud-run-auth';

/** User text never controls the API origin or endpoint. */
export async function catalogRequest<T>(
  path: string,
  params: Record<string, unknown>,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  const origin = process.env['SPECSYNC_API_URL'] ?? 'http://127.0.0.1:8080';
  const url = new URL(path, origin);
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== null)
      url.searchParams.set(
        key,
        Array.isArray(value) ? value.join(',') : String(value),
      );
  const timeout = AbortSignal.timeout(15000);
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    headers: {
      accept: 'application/json',
      ...(await cloudRunHeaders(origin)),
    },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok)
    throw new CatalogError(
      response.status === 422
        ? 'The catalog rejected the selection. Resolve IDs and attributes again.'
        : `Catalog request failed (${response.status}).`,
      response.status >= 500,
    );
  return schema.parse(await response.json());
}
export class CatalogError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
export async function withToolFailure<T>(
  operation: () => Promise<T>,
): Promise<T | { status: 'ERROR'; message: string; retryable: boolean }> {
  try {
    return await operation();
  } catch (error) {
    return {
      status: 'ERROR',
      message:
        error instanceof CatalogError
          ? error.message
          : 'Retrieval was unavailable or returned an invalid response. Do not infer missing vehicle data.',
      retryable: !(error instanceof CatalogError) || error.retryable,
    };
  }
}
