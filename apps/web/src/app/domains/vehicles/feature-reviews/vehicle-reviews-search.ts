import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnChanges,
  output,
  signal,
} from '@angular/core';
import { form } from '@angular/forms/signals';

import type { Comparison } from '../data/vehicle-contracts';
import type {
  VehicleQuestion,
  VehicleReviewsContext,
} from '../data/vehicle-interactions';
import { type RelatedReview, reviewMedia } from '../data/vehicle-reviews';
import { displayValue } from '../util/vehicle-display';
import { VehicleReviewsPane } from './ui/vehicle-reviews-pane';
import { VehicleReviewsSearchStore } from './vehicle-reviews-search-store';

@Component({
  selector: 'app-vehicle-reviews-search',
  imports: [VehicleReviewsPane],
  providers: [VehicleReviewsSearchStore],
  templateUrl: './vehicle-reviews-search.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleReviewsSearch implements OnChanges {
  readonly context = input.required<VehicleReviewsContext>();
  readonly closed = output<void>();
  readonly questionRequested = output<VehicleQuestion>();
  protected readonly store = inject(VehicleReviewsSearchStore);
  protected readonly filters = signal({ vehicle: '', media: '', query: '' });
  protected readonly filterForm = form(this.filters);
  protected readonly selected = signal<string[]>([]);
  protected readonly items = computed(
    () => this.store.reviewsValue()?.items ?? [],
  );
  protected readonly visible = computed(() =>
    filterReviews(this.items(), this.filters()),
  );
  protected readonly selectedReviews = computed(() =>
    this.items().filter((review) => this.selected().includes(review.id)),
  );
  protected readonly media = computed(() => [
    ...new Set(this.items().map((review) => reviewMedia(review.mediaType))),
  ]);
  protected readonly failedNames = computed(() =>
    failedVehicles(
      this.context().comparison,
      this.store.reviewsValue()?.failedConfigurationIds ?? [],
    ),
  );

  ngOnChanges(): void {
    const context = this.context();
    this.filters.set({
      vehicle: context.configurationId ?? '',
      media: '',
      query: '',
    });
    this.selected.set([]);
    this.store.load({
      configurationIds: context.comparison.configurations.map((c) => c.id),
      attributeCode: context.row.attribute.code,
    });
  }
  protected toggle(id: string): void {
    this.selected.update((ids) =>
      ids.includes(id)
        ? ids.filter((x) => x !== id)
        : ids.length < 8
          ? [...ids, id]
          : ids,
    );
  }
  protected reset(): void {
    this.filters.set({ vehicle: '', media: '', query: '' });
  }
  protected ask(): void {
    const reviews = this.selectedReviews();
    if (!reviews.length) return;
    this.questionRequested.emit({
      kind: 'reviews',
      attributeCode: this.context().row.attribute.code,
      configurationIds: this.context().comparison.configurations.map(
        (c) => c.id,
      ),
      evidenceIds: [...new Set(reviews.map((r) => r.evidenceId))],
      observationIds: reviews.map((r) => r.id),
    });
  }
  protected discover(): void {
    const configurations = this.context().comparison.configurations.filter(
      (c) => !this.filters().vehicle || c.id === this.filters().vehicle,
    );
    this.questionRequested.emit({
      kind: 'discover',
      configurations,
      attributeLabel: this.context().row.attribute.label,
    });
  }
}
function filterReviews(
  items: RelatedReview[],
  filters: { vehicle: string; media: string; query: string },
) {
  const query = filters.query.trim().toLocaleLowerCase();
  return items.filter(
    (r) =>
      (!filters.vehicle ||
        r.relatedConfigurationIds.includes(filters.vehicle)) &&
      (!filters.media || reviewMedia(r.mediaType) === filters.media) &&
      `${r.title} ${r.author ?? ''} ${r.excerpt} ${displayValue(r.conditions)}`
        .toLocaleLowerCase()
        .includes(query),
  );
}
function failedVehicles(comparison: Comparison, ids: string[]) {
  return comparison.configurations
    .filter((c) => ids.includes(c.id))
    .map((c) => c.name)
    .join(', ');
}
