import {
  type CatalogPage,
  catalogSearchSchema,
} from '../../vehicles/api/contracts';

/**
 * The page with its continuation (web `ChatVehicleCatalogOverview.page`). A
 * result recorded before the server returned continuation queries names
 * its search only in the tool arguments, so the continuation is derived
 * from them once, here, and the catalog feature pages on without knowing
 * about tool calls.
 */
export function catalogPageWithContinuation(
  page: CatalogPage | undefined,
  args: Record<string, unknown>,
): CatalogPage | undefined {
  if (!page || page.nextSearches || !page.hasMore) return page;
  const continuation = catalogSearchSchema.safeParse({
    q: typeof args['q'] === 'string' ? args['q'] : '',
    market: typeof args['market'] === 'string' ? args['market'] : undefined,
    modelYear:
      typeof args['modelYear'] === 'number' ? args['modelYear'] : undefined,
    limit: Math.min(20, Math.max(1, page.limit)),
    offset: page.offset + page.items.length,
  });
  return continuation.success
    ? { ...page, nextSearches: [continuation.data] }
    : page;
}

/** How the empty outcome names the search the agent ran. */
export function catalogQueryLabel(args: Record<string, unknown>): string {
  return [args['q'] || 'this search', args['market'], args['modelYear']]
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .join(' · ');
}
