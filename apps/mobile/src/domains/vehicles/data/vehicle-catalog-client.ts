import { gatewayJson } from '../../auth/api/session';
import {
  type CatalogPage,
  catalogPageSchema,
  type CatalogSearch,
  type Comparison,
  comparisonSchema,
  type VehicleImageMetadata,
} from './vehicle-contracts';

/** The facts a catalog shows next to each configuration. */
export const CATALOG_HIGHLIGHT_CODES = [
  'reference_price',
  'power_max',
  'torque_max',
  'payload',
  'adaptive_cruise',
  'camera_360',
] as const;

/** The comparison endpoint accepts at most this many configurations per call. */
const COMPARISON_LIMIT = 5;

/**
 * One continuation query of a rendered catalog, answered by the same catalog
 * endpoint the AI service searches, so the page grows in place (web
 * `VehicleCatalogClient.searchConfigurations`).
 */
export function searchConfigurations(
  search: CatalogSearch,
  signal?: AbortSignal,
): Promise<CatalogPage> {
  const params = new URLSearchParams({
    q: search.q,
    limit: String(search.limit),
    offset: String(search.offset),
  });
  if (search.market) params.set('market', search.market);
  if (search.modelYear !== undefined)
    params.set('modelYear', String(search.modelYear));
  return gatewayJson(
    `/api/vehicle-configurations?${params}`,
    (value) => catalogPageSchema.parse(value),
    { signal },
  );
}

/** The highlight facts of every configuration, in the order given. */
export async function loadHighlights(
  configurationIds: readonly string[],
  signal?: AbortSignal,
): Promise<Comparison> {
  const comparisons = await Promise.all(
    chunk([...configurationIds], COMPARISON_LIMIT).map((ids) =>
      requestComparison(
        ids.length === 1 ? '/api/vehicle-specifications' : '/api/comparisons',
        ids,
        [...CATALOG_HIGHLIGHT_CODES],
        signal,
      ),
    ),
  );
  return mergeComparisons(comparisons, [...configurationIds]);
}

/** The primary image of each configuration (null when it has none). */
export async function loadImages(
  configurationIds: readonly string[],
  signal?: AbortSignal,
): Promise<Record<string, VehicleImageMetadata | null>> {
  const result = await loadHighlights(configurationIds, signal);
  return Object.fromEntries(
    result.configurations.map(({ id, primaryImage }) => [
      id,
      primaryImage ?? null,
    ]),
  );
}

/** Every sourced specification of one configuration. */
export function loadSpecifications(
  configurationId: string,
  signal?: AbortSignal,
): Promise<Comparison> {
  return requestComparison(
    '/api/vehicle-specifications',
    [configurationId],
    [],
    signal,
  );
}

function requestComparison(
  path: '/api/vehicle-specifications' | '/api/comparisons',
  configurationIds: string[],
  attributes: string[],
  signal?: AbortSignal,
): Promise<Comparison> {
  const search = new URLSearchParams(
    path === '/api/comparisons'
      ? { configurationIds: configurationIds.join(',') }
      : { configurationId: configurationIds[0] ?? '' },
  );
  if (attributes.length) search.set('attributes', attributes.join(','));
  return gatewayJson(
    `${path}?${search}`,
    (value) => comparisonSchema.parse(value),
    { signal },
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/** Joins chunked comparisons back into one, in the requested order. */
export function mergeComparisons(
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
