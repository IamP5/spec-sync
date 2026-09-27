import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import { useState } from 'react';

import {
  loadHighlights,
  searchConfigurations,
} from '../data/vehicle-catalog-client';
import type {
  CatalogPage,
  CatalogSearch,
  VehicleConfiguration,
} from '../data/vehicle-contracts';
import { appendCatalogPages } from './catalog-presentation';

export const catalogHighlightsQuery = (configurationIds: readonly string[]) =>
  queryOptions({
    queryKey: ['vehicles', 'catalog', 'highlights', configurationIds],
    queryFn: ({ signal }) => loadHighlights(configurationIds, signal),
    enabled: configurationIds.length > 0,
    // The highlights stay on screen while the list grows and reloads them.
    placeholderData: keepPreviousData,
  });

interface Continuation {
  /** The page the continuation belongs to; a new page starts over. */
  pageKey: string;
  /** Configurations appended by "load next", in the order they arrived. */
  items: VehicleConfiguration[];
  /** Where the next "load next" continues; empty once the catalog is exhausted. */
  nextSearches: CatalogSearch[];
  failed: boolean;
}

/**
 * The list of one rendered catalog (web `VehicleCatalogSearchStore`): the
 * page the tool returned plus the continuation pages the reader loads in
 * place, and the highlights of all of them. Paging is a catalog interaction,
 * so it never goes through the agent: the next pages come straight from the
 * catalog API.
 */
export function useVehicleCatalogSearchStore(page: CatalogPage | undefined) {
  // A re-parsed tool result with the same content keeps the loaded pages.
  const pageKey = page
    ? JSON.stringify([page.items.map(({ id }) => id), page.nextSearches ?? []])
    : '';
  const [continuation, setContinuation] = useState<Continuation>(() =>
    freshContinuation(pageKey, page),
  );
  const current =
    continuation.pageKey === pageKey
      ? continuation
      : freshContinuation(pageKey, page);
  if (current !== continuation) setContinuation(current);

  const configurations = [...(page?.items ?? []), ...current.items];
  const highlights = useQuery(
    catalogHighlightsQuery(configurations.map(({ id }) => id)),
  );

  const nextPage = useMutation({
    mutationFn: async ({
      searches,
    }: {
      searches: CatalogSearch[];
      pageKey: string;
    }) =>
      Promise.all(
        searches.map(async (search) => ({
          search,
          page: await searchConfigurations(search),
        })),
      ),
    onSuccess: (results, variables) =>
      setContinuation((previous) => {
        // A late answer for a replaced page is dropped.
        if (previous.pageKey !== variables.pageKey) return previous;
        const { appended, nextSearches } = appendCatalogPages(
          [...(page?.items ?? []), ...previous.items].map(({ id }) => id),
          results,
        );
        return {
          ...previous,
          items: [...previous.items, ...appended],
          nextSearches,
          failed: false,
        };
      }),
    onError: (_error, variables) =>
      setContinuation((previous) =>
        previous.pageKey === variables.pageKey
          ? { ...previous, failed: true }
          : previous,
      ),
  });

  return {
    configurations,
    nextSearches: current.nextSearches,
    highlights: highlights.data,
    highlightsLoading: highlights.isLoading,
    highlightsFailed: highlights.isError,
    nextPageLoading: nextPage.isPending,
    nextPageFailed: current.failed,
    loadNextPage(): void {
      if (!current.nextSearches.length || nextPage.isPending) return;
      nextPage.mutate({ searches: current.nextSearches, pageKey });
    },
    retryHighlights(): void {
      void highlights.refetch();
    },
  };
}

function freshContinuation(
  pageKey: string,
  page: CatalogPage | undefined,
): Continuation {
  return {
    pageKey,
    items: [],
    nextSearches: page?.nextSearches ?? [],
    failed: false,
  };
}
