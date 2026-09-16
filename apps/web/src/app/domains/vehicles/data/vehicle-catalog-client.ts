import { HttpClient } from '@angular/common/http';
import { inject, Injectable, resource, type Signal } from '@angular/core';
import {
  firstValueFrom,
  fromEvent,
  map,
  type Observable,
  takeUntil,
} from 'rxjs';

import {
  type CatalogPage,
  catalogPageSchema,
  type CatalogSearch,
  type Comparison,
  comparisonSchema,
  type VehicleImageMetadata,
} from './vehicle-contracts';

export const CATALOG_HIGHLIGHT_CODES = [
  'reference_price',
  'power_max',
  'torque_max',
  'payload',
  'adaptive_cruise',
  'camera_360',
] as const;

const COMPARISON_LIMIT = 5;

@Injectable({ providedIn: 'root' })
export class VehicleCatalogClient {
  private readonly http = inject(HttpClient);
  summariesResource(configurationIds: Signal<readonly string[]>) {
    return resource({
      params: () => joinedIds(configurationIds()),
      loader: ({ params, abortSignal }) =>
        loadSummaries(this.http, params.split(','), abortSignal),
    });
  }

  imagesResource(configurationIds: Signal<readonly string[]>) {
    return resource({
      params: () => joinedIds(configurationIds()),
      loader: async ({
        params,
        abortSignal,
      }): Promise<Record<string, VehicleImageMetadata | null>> => {
        const result = await loadSummaries(
          this.http,
          params.split(','),
          abortSignal,
        );
        return Object.fromEntries(
          result.configurations.map(({ id, primaryImage }) => [
            id,
            primaryImage ?? null,
          ]),
        );
      },
    });
  }

  /**
   * One continuation query of a rendered catalog, answered by the same
   * catalog endpoint the AI service searches, so the page grows in place.
   */
  searchConfigurations(search: CatalogSearch): Observable<CatalogPage> {
    const params = new URLSearchParams({
      q: search.q,
      limit: String(search.limit),
      offset: String(search.offset),
    });
    if (search.market) params.set('market', search.market);
    if (search.modelYear !== undefined)
      params.set('modelYear', String(search.modelYear));
    return this.http
      .get<unknown>(`/api/vehicle-configurations?${params}`)
      .pipe(map((value) => catalogPageSchema.parse(value)));
  }

  detailResource(configurationId: Signal<string | undefined>) {
    return resource({
      params: configurationId,
      loader: ({ params, abortSignal }) =>
        requestComparison(
          this.http,
          '/api/vehicle-specifications',
          [params],
          [],
          abortSignal,
        ),
    });
  }
}

async function loadSummaries(
  http: HttpClient,
  configurationIds: string[],
  abortSignal: AbortSignal,
): Promise<Comparison> {
  const chunks = chunk(configurationIds, COMPARISON_LIMIT);
  const comparisons = await Promise.all(
    chunks.map((ids) =>
      requestComparison(
        http,
        ids.length === 1 ? '/api/vehicle-specifications' : '/api/comparisons',
        ids,
        [...CATALOG_HIGHLIGHT_CODES],
        abortSignal,
      ),
    ),
  );
  return mergeComparisons(comparisons, configurationIds);
}

async function requestComparison(
  http: HttpClient,
  path: string,
  configurationIds: string[],
  attributes: string[],
  abortSignal: AbortSignal,
): Promise<Comparison> {
  const search = new URLSearchParams({
    configurationId: configurationIds[0],
  });
  if (path === '/api/comparisons') {
    search.delete('configurationId');
    search.set('configurationIds', configurationIds.join(','));
  }
  if (attributes.length) search.set('attributes', attributes.join(','));
  abortSignal.throwIfAborted();
  const response = await firstValueFrom(
    http
      .get<unknown>(`${path}?${search}`)
      .pipe(takeUntil(fromEvent(abortSignal, 'abort'))),
  );
  return comparisonSchema.parse(response);
}

function joinedIds(ids: readonly string[]): string | undefined {
  return ids.length ? ids.join(',') : undefined;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function mergeComparisons(
  comparisons: Comparison[],
  configurationIds: string[],
): Comparison {
  const configurations = new Map(
    comparisons.flatMap((comparison) =>
      comparison.configurations.map(
        (configuration) => [configuration.id, configuration] as const,
      ),
    ),
  );
  const rows = new Map<string, Comparison['rows'][number]>();
  for (const comparison of comparisons) {
    for (const row of comparison.rows) {
      const existing = rows.get(row.attribute.code);
      rows.set(row.attribute.code, {
        attribute: row.attribute,
        cells: [...(existing?.cells ?? []), ...row.cells],
      });
    }
  }
  return {
    configurations: configurationIds
      .map((id) => configurations.get(id))
      .filter((value) => value !== undefined),
    rows: [...rows.values()].map((row) => ({
      ...row,
      cells: configurationIds
        .map((id) => row.cells.find((cell) => cell.configurationId === id))
        .filter((value) => value !== undefined),
    })),
  };
}
