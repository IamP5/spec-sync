import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { AngularToolCall, ToolRenderer } from '@copilotkit/angular';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardCardComponent } from '@/ui/components/card';
import { ZardDialogRef, ZardDialogService } from '@/ui/components/dialog';
import { ZardInputComponent } from '@/ui/components/input';
import { ZardSkeletonComponent } from '@/ui/components/skeleton';
import { ZardTableComponent } from '@/ui/components/table';

import {
  cellObservations,
  comparisonRows,
  displayValue,
  parseResult,
  safeSourceUrl,
} from '../data/vehicle-comparison';
import {
  type Comparison,
  comparisonSchema,
  failureSchema,
} from '../data/vehicle-contracts';
import { CHAT_CARD_ACTIONS } from './chat-card-actions';
import { VehicleReviewsDialog } from './vehicle-reviews-dialog';

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
export class VehicleComparisonCard
  implements ToolRenderer<Record<string, unknown>>
{
  readonly toolCall =
    input.required<AngularToolCall<Record<string, unknown>>>();
  private readonly dialog = inject(ZardDialogService);
  protected readonly actions = inject(CHAT_CARD_ACTIONS, { optional: true });
  private reviewDialog?: ZardDialogRef<VehicleReviewsDialog>;
  protected readonly result = computed(() =>
    parseResult(this.toolCall().result, comparisonSchema),
  );
  protected readonly error = computed(() =>
    parseResult(this.toolCall().result, failureSchema),
  );
  protected readonly filters = signal({ query: '' });
  protected readonly filterForm = form(this.filters);
  protected readonly differencesOnly = signal(false);
  protected readonly rows = computed(() =>
    filterRows(this.result(), this.differencesOnly(), this.filters().query),
  );
  protected readonly observations = cellObservations;
  protected readonly format = displayValue;
  protected readonly safeUrl = safeSourceUrl;
  protected readonly availability = availabilityLabel;
  protected readonly qualifiers = qualifierLabels;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reviewDialog?.close());
  }
  protected reset() {
    this.filters.set({ query: '' });
    this.differencesOnly.set(false);
  }
  protected openReviews(
    row: Comparison['rows'][number],
    configurationId?: string,
  ) {
    const comparison = this.result();
    const actions = this.actions;
    if (!comparison || !actions) return;
    this.reviewDialog?.close();
    this.reviewDialog = this.dialog.create({
      zTitle: `Avaliações sobre ${row.attribute.label}`,
      zDescription:
        'Explore relatos, confira a origem e selecione evidências para conversar.',
      zContent: VehicleReviewsDialog,
      zHideHeader: true,
      zHideFooter: true,
      zClosable: false,
      zWidth: '1120px',
      zDuration: 160,
      zCustomClasses:
        'specsync-review-dialog max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-3rem)] p-0 gap-0 overflow-hidden',
      zData: { comparison, row, configurationId, draft: actions.draft },
    });
  }
  protected followUp() {
    const comparison = this.result();
    if (!comparison) return;
    this.actions?.draft(
      `Para as configurações ${comparison.configurations.map((c) => `${c.brand} ${c.model} ${c.name} (${c.id})`).join('; ')}, explique as implicações práticas das diferenças em ${this.rows()
        .map((r) => r.attribute.code)
        .join(', ')}. Considere o meu uso: `,
    );
  }
}
function filterRows(
  comparison: Comparison | undefined,
  differences: boolean,
  query: string,
) {
  const search = query.trim().toLocaleLowerCase();
  return comparisonRows(comparison, differences).filter((r) =>
    `${r.attribute.label} ${r.attribute.code}`
      .toLocaleLowerCase()
      .includes(search),
  );
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
