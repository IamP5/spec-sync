import { z } from 'zod';

import { catalogRequest, withToolFailure } from './api-client';
import { configurationSchema, failureSchema, searchSchema } from './contracts';

/**
 * Searches one catalog call may carry: every model the user names plus one
 * broad brand query for the rest of a lineup. The cap is part of the contract
 * with `apps/web` (`nextSearches` is bounded the same way there).
 */
export const MAX_CATALOG_SEARCHES = 8;

const catalogQuerySchema = searchSchema
  .extend({
    limit: z.number().int().min(1).max(20).default(20),
  })
  .strict();

export const catalogSearchInputSchema = z
  .object({
    searches: z
      .array(catalogQuerySchema)
      .min(1)
      .max(MAX_CATALOG_SEARCHES)
      .describe(
        'All vehicle searches for this catalog in one call, in display order. Keep each vehicle name literal; use a brand name or an empty q to browse a lineup.',
      ),
  })
  .strict();

const pageSchema = z.object({
  items: z.array(configurationSchema),
  limit: z.number().int(),
  offset: z.number().int(),
  hasMore: z.boolean(),
});

export const catalogSearchOutputSchema = z.union([
  pageSchema.extend({
    status: z.enum(['OK', 'PARTIAL']),
    nextSearches: z.array(catalogQuerySchema).max(MAX_CATALOG_SEARCHES),
    notices: z.array(z.string()),
  }),
  failureSchema,
]);

/**
 * One agent tool call produces one authoritative catalog for every requested
 * vehicle. Results keep the order of the searches and drop configurations
 * already listed by an earlier search, so a lineup request can name the
 * models to show first and end with a broad brand query for the rest.
 */
export async function searchCatalog(
  input: z.infer<typeof catalogSearchInputSchema>,
  signal?: AbortSignal,
): Promise<z.infer<typeof catalogSearchOutputSchema>> {
  const { searches } = catalogSearchInputSchema.parse(input);
  signal?.throwIfAborted();
  const unique = [
    ...new Map(
      searches.map((search) => [JSON.stringify(search), search]),
    ).values(),
  ];
  const results = await Promise.all(
    unique.map(async (search) => {
      const result = await withToolFailure(() =>
        catalogRequest(
          '/api/vehicle-configurations',
          search,
          pageSchema,
          signal,
        ),
      );
      signal?.throwIfAborted();
      return { search, result };
    }),
  );
  const vehicles = new Map<string, z.infer<typeof configurationSchema>>();
  const nextSearches: z.infer<typeof catalogQuerySchema>[] = [];
  const notices: string[] = [];
  let failures = 0;
  let retryable = false;
  for (const { search, result } of results) {
    const scope = [search.q || 'the catalog', search.market, search.modelYear]
      .filter(Boolean)
      .join(' · ');
    if ('status' in result) {
      failures++;
      retryable ||= result.retryable;
      notices.push(`${scope}: ${result.message}`);
      continue;
    }
    for (const vehicle of result.items) vehicles.set(vehicle.id, vehicle);
    if (!result.items.length)
      notices.push(`No configurations found for ${scope}.`);
    if (result.hasMore)
      nextSearches.push({
        ...search,
        offset: result.offset + result.items.length,
      });
  }
  if (failures === results.length)
    return { status: 'ERROR', message: notices.join(' '), retryable };
  return {
    status: failures ? 'PARTIAL' : 'OK',
    items: [...vehicles.values()],
    limit:
      nextSearches.reduce((sum, search) => sum + search.limit, 0) ||
      unique.reduce((sum, search) => sum + search.limit, 0),
    offset: 0,
    hasMore: nextSearches.length > 0,
    nextSearches,
    notices,
  };
}
