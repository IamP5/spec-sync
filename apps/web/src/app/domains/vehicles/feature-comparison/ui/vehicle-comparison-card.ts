import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { type FieldTree, FormField } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';

import { ZardSkeletonComponent } from '@/ui/components/skeleton';

import {
  cellObservations,
  comparisonRows,
} from '../../data/vehicle-comparison';
import type { Comparison } from '../../data/vehicle-contracts';
import { displayValue, safeSourceUrl } from '../../util/vehicle-display';

type Row = Comparison['rows'][number];
type Cell = Row['cells'][number];
type Observation = Cell['observations'][number];

interface CellSummary {
  readonly text: string;
  readonly tone: 'value' | 'availability' | 'muted' | 'warning';
}

/**
 * The comparison as an attribute list attached to the reply: the vehicles
 * are numbered once in a legend that stays pinned while the list scrolls,
 * every attribute is one hairline row with the values as numbered chips, and
 * sources open per row. Tapping a number (in the legend or a chip) names
 * that vehicle next to its values, which also serves touch screens.
 */
@Component({
  selector: 'app-vehicle-comparison-card',
  imports: [FormField, NgIcon, ZardSkeletonComponent],
  viewProviders: [provideIcons({ lucideSearch })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
  templateUrl: './vehicle-comparison-card.html',
})
export class VehicleComparisonCard {
  readonly result = input<Comparison>();
  readonly failure = input<string>();
  readonly complete = input(false);
  readonly questionsEnabled = input(true);
  readonly queryField = input.required<FieldTree<string>>();
  readonly differencesOnly = input(false);
  readonly rows = input<Row[]>([]);
  readonly differencesChanged = output<boolean>();
  readonly filtersCleared = output<void>();
  readonly reviewsRequested = output<{
    row: Row;
    configurationId?: string;
  }>();
  readonly followUpRequested = output<void>();

  /** Numbers only make sense against other vehicles. */
  protected readonly numbered = computed(
    () => (this.result()?.configurations.length ?? 0) > 1,
  );
  /** Attribute ids whose cells differ or are uncertain. */
  protected readonly differing = computed(
    () =>
      new Set(
        comparisonRows(this.result(), true).map((row) => row.attribute.id),
      ),
  );
  /** Configurations whose name is shown next to every one of their values. */
  protected readonly named = signal<ReadonlySet<string>>(new Set());
  protected readonly observations = cellObservations;
  protected readonly format = displayValue;
  protected readonly safeUrl = safeSourceUrl;
  protected readonly availability = availabilityLabel;
  protected readonly qualifiers = qualifierLabels;

  protected isNamed(configurationId: string): boolean {
    return this.named().has(configurationId);
  }
  protected toggleName(configurationId: string): void {
    this.named.update((named) => {
      const next = new Set(named);
      if (!next.delete(configurationId)) next.add(configurationId);
      return next;
    });
  }
  protected cell(row: Row, configurationId: string): Cell | undefined {
    return row.cells.find((cell) => cell.configurationId === configurationId);
  }
  protected summary(row: Row, configurationId: string): CellSummary {
    const cell = this.cell(row, configurationId);
    if (!cell || cell.knowledgeStatus === 'NOT_REPORTED')
      return { text: '—', tone: 'muted' };
    if (cell.knowledgeStatus === 'CONFLICTING')
      return { text: 'Divergente', tone: 'warning' };
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
  protected hasDetails(row: Row): boolean {
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
  protected observationValue(observation: Observation, row: Row): string {
    const value =
      observation.value === null ? '' : displayValue(observation.value);
    return [
      value && row.attribute.unit ? `${value} ${row.attribute.unit}` : value,
      availabilityLabel(observation.availability),
    ]
      .filter(Boolean)
      .join(' · ');
  }
  protected openReviews(row: Row, configurationId?: string): void {
    this.reviewsRequested.emit({ row, configurationId });
  }
}
function availabilityLabel(value: string | null) {
  return (
    (
      {
        STANDARD: 'De série',
        OPTIONAL: 'Opcional',
        ABSENT: 'Não disponível',
        NOT_APPLICABLE: 'Não se aplica',
      } as Record<string, string>
    )[value ?? ''] ?? ''
  );
}
function qualifierLabels(qualifiers: Record<string, unknown>) {
  const labels: Record<string, string> = {
    rpm: 'Rotação (rpm)',
    engine_speed_rpm: 'Rotação (rpm)',
    engine_speed_rpm_min: 'Rotação mínima (rpm)',
    engine_speed_rpm_max: 'Rotação máxima (rpm)',
    package: 'Pacote',
    packages: 'Pacotes',
    fuel: 'Combustível',
    conditions: 'Condições',
    scope: 'Escopo',
    date: 'Data',
    note: 'Nota',
    source_unit: 'Unidade na fonte',
    source_value: 'Valor na fonte',
    source_scope: 'Escopo na fonte',
    source_section: 'Seção da fonte',
    source_also_mentions: 'A fonte também menciona',
    manufacturer_term: 'Termo do fabricante',
    completeness: 'Abrangência',
    conversion_factor: 'Fator de conversão',
    current_price_verified: 'Preço atual verificado',
    effective_on: 'Vigência',
    interpretation: 'Interpretação',
    moving_object_detection: 'Detecção de objetos em movimento',
    off_road: 'Uso fora de estrada',
    price_kind: 'Tipo de preço',
    stop_and_go: 'Parada e retomada',
    same_as_first_column: 'Mesmo valor da primeira coluna na fonte',
  };
  return Object.entries(qualifiers).map(([key, value]) =>
    key === 'package_id'
      ? 'Vinculado a pacote opcional. Confira as condições na fonte.'
      : `${labels[key] ?? key.replace(/_/g, ' ')}: ${typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : displayValue(value)}`,
  );
}
