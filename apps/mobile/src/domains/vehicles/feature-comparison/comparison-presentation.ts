import {
  cellObservations,
  comparisonRows,
  hiddenComparisonRowCount,
} from '../data/vehicle-comparison';
import type { Comparison } from '../data/vehicle-contracts';
import { displayValue } from '../util/vehicle-display';

export type ComparisonRow = Comparison['rows'][number];
export type ComparisonCell = ComparisonRow['cells'][number];
export type ComparisonObservation = ComparisonCell['observations'][number];

export interface CellSummary {
  readonly text: string;
  readonly tone: 'value' | 'availability' | 'muted' | 'warning';
}

/** The rows that match the text filter, optionally only those that differ. */
export function filterRows(
  comparison: Comparison | undefined,
  differencesOnly: boolean,
  query: string,
): ComparisonRow[] {
  const search = query.trim().toLocaleLowerCase();
  return comparisonRows(comparison, differencesOnly).filter((row) =>
    `${row.attribute.label} ${row.attribute.code}`
      .toLocaleLowerCase()
      .includes(search),
  );
}

/**
 * How the card counts its rows: those some vehicle reports (the base the
 * filters narrow down) and those no vehicle reports, which stay hidden.
 */
export function rowCounts(comparison: Comparison | undefined): {
  reported: number;
  hidden: number;
} {
  return {
    reported: comparisonRows(comparison, false).length,
    hidden: hiddenComparisonRowCount(comparison),
  };
}

/** "one item without data for any vehicle is hidden", or empty. */
export function hiddenRowsLabel(hidden: number): string {
  if (hidden <= 0) return '';
  return hidden === 1
    ? 'one item without data for any vehicle is hidden'
    : `${hidden} items without data for any vehicle are hidden`;
}

/** Attribute ids whose cells differ or are uncertain. */
export function differingAttributeIds(
  comparison: Comparison | undefined,
): ReadonlySet<string> {
  return new Set(
    comparisonRows(comparison, true).map((row) => row.attribute.id),
  );
}

export function cellOf(
  row: ComparisonRow,
  configurationId: string,
): ComparisonCell | undefined {
  return row.cells.find((cell) => cell.configurationId === configurationId);
}

/** The chip text of one vehicle's value in a row. */
export function cellSummary(
  row: ComparisonRow,
  configurationId: string,
): CellSummary {
  const cell = cellOf(row, configurationId);
  if (!cell || cell.knowledgeStatus === 'NOT_REPORTED')
    return { text: '—', tone: 'muted' };
  if (cell.knowledgeStatus === 'CONFLICTING')
    return { text: 'Conflicting', tone: 'warning' };
  const observation = cellObservations(cell)[0];
  if (!observation) return { text: '—', tone: 'muted' };
  if (observation.value !== null)
    return {
      text: `${displayValue(observation.value)}${row.attribute.unit ? ` ${row.attribute.unit}` : ''}`,
      tone: 'value',
    };
  if (observation.availability)
    return {
      text: availabilityLabel(observation.availability),
      tone: 'availability',
    };
  return { text: '—', tone: 'muted' };
}

/** Whether a row has anything beyond the chip values: unknowns, qualifiers or evidence. */
export function hasDetails(row: ComparisonRow): boolean {
  return row.cells.some(
    (cell) =>
      cell.knowledgeStatus !== 'KNOWN' ||
      cellObservations(cell).some(
        (observation) =>
          Object.keys(observation.qualifiers).length > 0 ||
          observation.evidence.length > 0,
      ),
  );
}

export function observationValue(
  observation: ComparisonObservation,
  row: ComparisonRow,
): string {
  const value =
    observation.value === null ? '' : displayValue(observation.value);
  return [
    value && row.attribute.unit ? `${value} ${row.attribute.unit}` : value,
    availabilityLabel(observation.availability),
  ]
    .filter(Boolean)
    .join(' · ');
}

export function availabilityLabel(value: string | null): string {
  return (
    (
      {
        STANDARD: 'Standard',
        OPTIONAL: 'Optional',
        ABSENT: 'Not available',
        NOT_APPLICABLE: 'Not applicable',
      } as Record<string, string>
    )[value ?? ''] ?? ''
  );
}

const QUALIFIER_LABELS: Record<string, string> = {
  rpm: 'Engine speed (rpm)',
  engine_speed_rpm: 'Engine speed (rpm)',
  engine_speed_rpm_min: 'Minimum engine speed (rpm)',
  engine_speed_rpm_max: 'Maximum engine speed (rpm)',
  package: 'Package',
  packages: 'Packages',
  fuel: 'Fuel',
  conditions: 'Conditions',
  scope: 'Scope',
  date: 'Date',
  note: 'Note',
  source_unit: 'Unit in the source',
  source_value: 'Value in the source',
  source_scope: 'Scope in the source',
  source_section: 'Section of the source',
  source_also_mentions: 'The source also mentions',
  manufacturer_term: 'Manufacturer term',
  completeness: 'Coverage',
  conversion_factor: 'Conversion factor',
  current_price_verified: 'Current price verified',
  effective_on: 'Effective on',
  interpretation: 'Interpretation',
  moving_object_detection: 'Moving object detection',
  off_road: 'Off-road use',
  price_kind: 'Price type',
  stop_and_go: 'Stop and go',
  same_as_first_column: 'Same value as the first column in the source',
};

/** Qualifiers as readable lines; an optional package reads as a caution. */
export function qualifierLabels(qualifiers: Record<string, unknown>): string[] {
  return Object.entries(qualifiers).map(([key, value]) =>
    key === 'package_id'
      ? 'Tied to an optional package. Check the conditions in the source.'
      : `${QUALIFIER_LABELS[key] ?? key.replace(/_/g, ' ')}: ${typeof value === 'boolean' ? (value ? 'Yes' : 'No') : displayValue(value)}`,
  );
}

export function evidenceProvenance(provenance: string): string {
  return provenance === 'CURATED_NOTE' ? 'Compiled notes' : provenance;
}
