import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { type FieldTree, FormField } from '@angular/forms/signals';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardInputComponent } from '@/ui/components/input';
import { ZardSkeletonComponent } from '@/ui/components/skeleton';

import { cellObservations } from '../../data/vehicle-comparison';
import type { VehicleReviewsContext } from '../../data/vehicle-interactions';
import {
  type RelatedReview,
  reviewMedia,
  reviewUrl,
} from '../../data/vehicle-reviews';
import { displayValue } from '../../util/vehicle-display';

let nextReviewFiltersId = 0;

@Component({
  selector: 'app-vehicle-reviews-pane',
  imports: [
    FormField,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardInputComponent,
    ZardSkeletonComponent,
  ],
  templateUrl: './vehicle-reviews-pane.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleReviewsPane {
  protected readonly filtersId = `review-filters-${++nextReviewFiltersId}`;
  protected readonly filtersExpanded = signal(false);
  protected readonly activeFilters = computed(
    () =>
      Number(!!this.filterForm().vehicle().value()) +
      Number(!!this.filterForm().media().value()),
  );
  readonly context = input.required<VehicleReviewsContext>();
  readonly filterForm =
    input.required<
      FieldTree<{ vehicle: string; media: string; query: string }>
    >();
  readonly loading = input(false);
  readonly failed = input(false);
  readonly limited = input(false);
  readonly failedNames = input('');
  readonly items = input<RelatedReview[]>([]);
  readonly visible = input<RelatedReview[]>([]);
  readonly selected = input<string[]>([]);
  readonly selectedReviews = input<RelatedReview[]>([]);
  readonly media = input<string[]>([]);
  readonly closed = output<void>();
  readonly retried = output<void>();
  readonly selectionToggled = output<string>();
  readonly filtersCleared = output<void>();
  readonly askRequested = output<void>();
  readonly discoverRequested = output<void>();
  private readonly queryInput =
    viewChild<ElementRef<HTMLInputElement>>('reviewQuery');
  protected readonly format = displayValue;
  protected readonly mediaLabel = reviewMedia;
  protected readonly kindLabel = reviewKind;
  protected readonly link = reviewUrl;
  protected reset(): void {
    this.filtersCleared.emit();
    this.queryInput()?.nativeElement.focus();
  }
  protected vehicleName(review: RelatedReview) {
    if (review.scope === 'MODEL')
      return 'Sobre o modelo · versão não confirmada';
    return (
      this.context().comparison.configurations.find(
        (c) => c.id === review.configurationId,
      )?.name ?? 'Versão da avaliação'
    );
  }
  protected specification(id: string) {
    const cell = this.context().row.cells.find((c) => c.configurationId === id);
    if (!cell || cell.knowledgeStatus === 'NOT_REPORTED')
      return 'Não informado';
    if (cell.knowledgeStatus === 'CONFLICTING') return 'Dados divergentes';
    return cellObservations(cell)
      .map((o) => {
        const availability = (
          {
            STANDARD: 'De série',
            OPTIONAL: 'Opcional',
            ABSENT: 'Não disponível',
            NOT_APPLICABLE: 'Não se aplica',
          } as Record<string, string>
        )[o.availability ?? ''];
        const value =
          o.value === null
            ? ''
            : `${displayValue(o.value)} ${this.context().row.attribute.unit ?? ''}`.trim();
        const rpm = o.qualifiers['engine_speed_rpm'];
        return [
          value,
          availability,
          typeof rpm === 'number'
            ? `${rpm.toLocaleString('pt-BR')} rpm`
            : undefined,
        ]
          .filter(Boolean)
          .join(' · ');
      })
      .join(' · ');
  }
}
function reviewKind(kind: string | null | undefined) {
  return (
    (
      {
        OPINION: 'Opinião do avaliador',
        MEASUREMENT: 'Medição do avaliador',
        REPORTED_SPEC: 'Especificação citada no relato',
        OWNER_EXPERIENCE: 'Experiência de proprietário',
      } as Record<string, string>
    )[kind ?? ''] ?? 'Relato'
  );
}
