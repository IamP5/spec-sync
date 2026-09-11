import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  LOCALE_ID,
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
  private readonly locale = inject(LOCALE_ID);
  protected readonly format = displayValue;
  protected readonly unknownAuthor = $localize`Author not reported`;
  protected readonly unknownLocation = $localize`Location not reported`;
  protected readonly mediaLabel = reviewMedia;
  protected readonly kindLabel = reviewKind;
  protected readonly link = reviewUrl;
  protected readonly selectedLabel = $localize`Selected ✓`;
  protected readonly selectLabel2 = $localize`Select +`;

  protected selectLabel(title: string): string {
    return $localize`Select report: ${title}:title:`;
  }
  protected removeSelectionLabel(title: string): string {
    return $localize`Remove selection: ${title}:title:`;
  }

  protected reset(): void {
    this.filtersCleared.emit();
    this.queryInput()?.nativeElement.focus();
  }
  protected vehicleName(review: RelatedReview) {
    if (review.scope === 'MODEL')
      return $localize`About the model · version not confirmed`;
    return (
      this.context().comparison.configurations.find(
        (c) => c.id === review.configurationId,
      )?.name ?? $localize`Reviewed version`
    );
  }
  protected specification(id: string) {
    const cell = this.context().row.cells.find((c) => c.configurationId === id);
    if (!cell || cell.knowledgeStatus === 'NOT_REPORTED')
      return $localize`Not reported`;
    if (cell.knowledgeStatus === 'CONFLICTING')
      return $localize`Conflicting data`;
    return cellObservations(cell)
      .map((o) => {
        const availability = (
          {
            STANDARD: $localize`Standard`,
            OPTIONAL: $localize`Optional`,
            ABSENT: $localize`Not available`,
            NOT_APPLICABLE: $localize`Not applicable`,
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
            ? `${rpm.toLocaleString(this.locale)} rpm`
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
        OPINION: $localize`Reviewer opinion`,
        MEASUREMENT: $localize`Reviewer measurement`,
        REPORTED_SPEC: $localize`Specification quoted in the report`,
        OWNER_EXPERIENCE: $localize`Owner experience`,
      } as Record<string, string>
    )[kind ?? ''] ?? $localize`Report`
  );
}
