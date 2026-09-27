import { cellObservations } from '../data/vehicle-comparison';
import type {
  CatalogPage,
  CatalogSearch,
  Comparison,
  VehicleConfiguration,
} from '../data/vehicle-contracts';
import { displayValue } from '../util/vehicle-display';

export type SortMode =
  | 'catalog-order'
  | 'price-asc'
  | 'power-desc'
  | 'torque-desc';
/** How the loaded page reads in the transcript: a strip of cards or a flush list. */
export type CatalogLayout = 'strip' | 'list';
export type FactStatus = 'known' | 'not-reported' | 'conflicting';

export interface CatalogFact {
  readonly text: string;
  readonly numeric?: number;
  readonly status: FactStatus;
}

export interface ModelSummary {
  readonly brand: string;
  readonly model: string;
  readonly configurationCount: number;
}

export const MAX_SHORTLIST = 5;
/** Configurations revealed per "show more" step, so a result stays short in the transcript. */
export const CATALOG_PAGE_STEP = 4;
/** Pages above this size open as a list: that many cards would scroll far past the reply. */
export const LARGE_CATALOG_PAGE = 8;

export const SORT_OPTIONS: readonly { value: SortMode; label: string }[] = [
  { value: 'catalog-order', label: 'Catalog order' },
  { value: 'price-asc', label: 'Lowest price' },
  { value: 'power-desc', label: 'Highest power' },
  { value: 'torque-desc', label: 'Highest torque' },
];

/** The highlight facts every catalog item shows, in reading order. */
export const CATALOG_METRICS = [
  { label: 'Power', code: 'power_max' },
  { label: 'Torque', code: 'torque_max' },
  { label: 'Reference price', code: 'reference_price' },
] as const;

export function defaultCatalogLayout(pageSize: number): CatalogLayout {
  return pageSize > LARGE_CATALOG_PAGE ? 'list' : 'strip';
}

/** Short badge text for an unconfirmed catalog identity; empty when confirmed. */
export function identityLabel(vehicle: VehicleConfiguration): string {
  return vehicle.identityStatus === 'CONFIRMED'
    ? ''
    : vehicle.identityStatus === 'PROVISIONAL'
      ? 'Provisional'
      : 'From notes';
}

export function vehicleName(vehicle: VehicleConfiguration): string {
  return `${vehicle.brand} ${vehicle.model} ${vehicle.name}`;
}

export function modelSummaries(
  configurations: VehicleConfiguration[],
): ModelSummary[] {
  const summaries = new Map<string, ModelSummary>();
  for (const vehicle of configurations) {
    const current = summaries.get(vehicle.model);
    summaries.set(vehicle.model, {
      brand: vehicle.brand,
      model: vehicle.model,
      configurationCount: (current?.configurationCount ?? 0) + 1,
    });
  }
  return [...summaries.values()];
}

export function filterAndSortConfigurations(
  configurations: VehicleConfiguration[],
  query: string,
  model: string,
  sort: SortMode,
  summary: Comparison | undefined,
): VehicleConfiguration[] {
  const literal = query.trim().toLocaleLowerCase();
  const filtered = configurations.filter(
    (vehicle) =>
      (!literal ||
        `${vehicle.brand} ${vehicle.model} ${vehicle.name}`
          .toLocaleLowerCase()
          .includes(literal)) &&
      (model === 'all' || vehicle.model === model),
  );
  if (sort === 'catalog-order') return filtered;
  const [code, direction] =
    sort === 'price-asc'
      ? (['reference_price', 1] as const)
      : sort === 'power-desc'
        ? (['power_max', -1] as const)
        : (['torque_max', -1] as const);
  return filtered
    .map((vehicle, index) => ({ vehicle, index }))
    .sort((left, right) => {
      const a = catalogFact(summary, left.vehicle.id, code).numeric;
      const b = catalogFact(summary, right.vehicle.id, code).numeric;
      if (a === undefined && b === undefined) return left.index - right.index;
      if (a === undefined) return 1;
      if (b === undefined) return -1;
      return direction * (a - b) || left.index - right.index;
    })
    .map(({ vehicle }) => vehicle);
}

export function catalogFact(
  comparison: Comparison | undefined,
  configurationId: string,
  code: string,
  locale = 'en-US',
): CatalogFact {
  const row = comparison?.rows.find(
    (candidate) => candidate.attribute.code === code,
  );
  const cell = row?.cells.find(
    (candidate) => candidate.configurationId === configurationId,
  );
  if (!cell || cell.knowledgeStatus === 'NOT_REPORTED')
    return { text: 'Not reported', status: 'not-reported' };
  if (cell.knowledgeStatus === 'CONFLICTING')
    return { text: 'Conflicting', status: 'conflicting' };
  const observation = cellObservations(cell)[0];
  if (!observation) return { text: 'Not reported', status: 'not-reported' };
  if (observation.availability)
    return {
      text: availabilityLabel(observation.availability),
      status: 'known',
    };
  const numeric =
    typeof observation.value === 'number' ? observation.value : undefined;
  if (code === 'reference_price' && numeric !== undefined)
    return {
      // The catalog prices Brazilian vehicles, so the currency is fixed;
      // only the way the amount reads follows the user's language.
      text: formatPrice(numeric, locale),
      numeric,
      status: 'known',
    };
  const value = displayValue(observation.value);
  return {
    text: `${value}${value && row?.attribute.unit ? ` ${row.attribute.unit}` : ''}`,
    numeric,
    status: 'known',
  };
}

export function formatPrice(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

export function availabilityLabel(value: string): string {
  return (
    (
      {
        STANDARD: 'Standard',
        OPTIONAL: 'Optional',
        ABSENT: 'Absent',
        NOT_APPLICABLE: 'Not applicable',
      } as Record<string, string>
    )[value] ?? value
  );
}

export function sortMode(value: string): SortMode {
  return value === 'price-asc' ||
    value === 'power-desc' ||
    value === 'torque-desc'
    ? value
    : 'catalog-order';
}

/** The photo of a configuration: its own, or the one the highlights returned. */
export function catalogImage(
  vehicle: VehicleConfiguration,
  summaries: Comparison | undefined,
) {
  return (
    vehicle.primaryImage ??
    summaries?.configurations.find(({ id }) => id === vehicle.id)?.primaryImage
  );
}

export type ShortlistChange =
  | { kind: 'changed'; selected: VehicleConfiguration[] }
  | { kind: 'full'; message: string };

/** Adds or removes one configuration; a full shortlist refuses a sixth. */
export function toggleShortlist(
  current: VehicleConfiguration[],
  vehicle: VehicleConfiguration,
): ShortlistChange {
  const next = new Map(current.map((item) => [item.id, item]));
  if (next.has(vehicle.id)) next.delete(vehicle.id);
  else if (next.size < MAX_SHORTLIST) next.set(vehicle.id, vehicle);
  else
    return {
      kind: 'full',
      message: `Choose up to ${MAX_SHORTLIST} configurations for one comparison.`,
    };
  return { kind: 'changed', selected: [...next.values()] };
}

/**
 * Appends continuation pages to a catalog: vehicles already shown are
 * skipped, and every search that has more continues after what it returned.
 */
export function appendCatalogPages(
  knownIds: readonly string[],
  results: readonly { search: CatalogSearch; page: CatalogPage }[],
): { appended: VehicleConfiguration[]; nextSearches: CatalogSearch[] } {
  const known = new Set(knownIds);
  const appended: VehicleConfiguration[] = [];
  const nextSearches: CatalogSearch[] = [];
  for (const { search, page } of results) {
    for (const vehicle of page.items) {
      if (known.has(vehicle.id)) continue;
      known.add(vehicle.id);
      appended.push(vehicle);
    }
    if (page.hasMore)
      nextSearches.push({
        ...search,
        offset: page.offset + page.items.length,
      });
  }
  return { appended, nextSearches };
}

/** What the card renders: the grown list and the paging that remains. */
export function catalogView(
  page: CatalogPage,
  configurations: VehicleConfiguration[],
  nextSearches: CatalogSearch[],
): CatalogPage {
  return {
    ...page,
    items: configurations,
    hasMore: nextSearches.length > 0,
    limit:
      nextSearches.reduce((sum, search) => sum + search.limit, 0) || page.limit,
  };
}
