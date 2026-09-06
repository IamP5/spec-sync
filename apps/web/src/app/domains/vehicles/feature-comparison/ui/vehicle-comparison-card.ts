import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { type FieldTree, FormField } from '@angular/forms/signals';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardCardComponent } from '@/ui/components/card';
import { ZardInputComponent } from '@/ui/components/input';
import { ZardSkeletonComponent } from '@/ui/components/skeleton';
import { ZardTableComponent } from '@/ui/components/table';

import { cellObservations } from '../../data/vehicle-comparison';
import type { Comparison } from '../../data/vehicle-contracts';
import { displayValue, safeSourceUrl } from '../../util/vehicle-display';
@Component({
  selector: 'app-vehicle-comparison-card',
  imports: [
    FormField,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardCardComponent,
    ZardInputComponent,
    ZardSkeletonComponent,
    ZardTableComponent,
  ],
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
  readonly rows = input<Comparison['rows']>([]);
  readonly differencesChanged = output<boolean>();
  readonly filtersCleared = output<void>();
  readonly reviewsRequested = output<{
    row: Comparison['rows'][number];
    configurationId?: string;
  }>();
  readonly followUpRequested = output<void>();
  protected readonly observations = cellObservations;
  protected readonly format = displayValue;
  protected readonly safeUrl = safeSourceUrl;
  protected readonly availability = availabilityLabel;
  protected readonly qualifiers = qualifierLabels;
  protected openReviews(
    row: Comparison['rows'][number],
    configurationId?: string,
  ): void {
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
