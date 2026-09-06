import { cellObservations } from '../data/vehicle-comparison';
import type {
  Comparison,
  VehicleConfiguration,
} from '../data/vehicle-contracts';
import { displayValue } from '../util/vehicle-display';

export type CatalogView = 'catalog' | 'competitors';
export type SortMode =
  | 'catalog-order'
  | 'price-asc'
  | 'power-desc'
  | 'torque-desc';
type FactStatus = 'known' | 'not-reported' | 'conflicting';

interface CatalogFact {
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
  brand: string,
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
      (brand === 'all' || vehicle.brand === brand) &&
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
      text: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      }).format(numeric),
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

function availabilityLabel(value: string): string {
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
