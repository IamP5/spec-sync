import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnChanges,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { form } from '@angular/forms/signals';

import {
  ZardDrawerComponent,
  ZardDrawerTitleComponent,
} from '@/ui/components/drawer';

import { comparisonRows } from '../data/vehicle-comparison';
import type { Comparison } from '../data/vehicle-contracts';
import type {
  VehicleQuestion,
  VehicleReviewsContext,
} from '../data/vehicle-interactions';
import { VehicleReviewsSearch } from '../feature-reviews';
import { VehicleComparisonCard } from './ui/vehicle-comparison-card';
import { VehicleComparisonLookupStore } from './vehicle-comparison-lookup-store';

@Component({
  selector: 'app-vehicle-comparison-overview',
  imports: [
    VehicleComparisonCard,
    VehicleReviewsSearch,
    ZardDrawerComponent,
    ZardDrawerTitleComponent,
  ],
  providers: [VehicleComparisonLookupStore],
  templateUrl: './vehicle-comparison-overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
})
export class VehicleComparisonOverview implements OnChanges {
  private readonly lookup = inject(VehicleComparisonLookupStore);
  protected readonly images = this.lookup.imagesValue;
  readonly comparison = input<Comparison>();
  readonly failure = input<string>();
  readonly complete = input(false);
  readonly questionsEnabled = input(true);
  readonly questionRequested = output<VehicleQuestion>();
  protected readonly mobileScreen = toSignal(
    inject(BreakpointObserver).observe('(max-width: 767px)'),
    { initialValue: { matches: false, breakpoints: {} } },
  );
  protected readonly reviewsOpen = signal(false);
  private pendingQuestion?: VehicleQuestion;
  protected readonly reviewContext = signal<VehicleReviewsContext | undefined>(
    undefined,
  );
  protected readonly filters = signal({ query: '' });
  protected readonly filterForm = form(this.filters);
  protected readonly differencesOnly = signal(false);
  protected readonly rows = computed(() =>
    filterRows(this.comparison(), this.differencesOnly(), this.filters().query),
  );

  ngOnChanges(): void {
    this.lookup.load(
      (this.comparison()?.configurations ?? [])
        .filter(({ primaryImage }) => !primaryImage)
        .map(({ id }) => id),
    );
  }

  protected reset(): void {
    this.filters.set({ query: '' });
    this.differencesOnly.set(false);
  }
  protected openReviews(
    request: Omit<VehicleReviewsContext, 'comparison'>,
  ): void {
    const comparison = this.comparison();
    if (!comparison) return;
    this.pendingQuestion = undefined;
    this.reviewContext.set({ comparison, ...request });
    this.reviewsOpen.set(true);
  }
  protected closeReviews(): void {
    this.reviewsOpen.set(false);
  }
  protected finishReview(question: VehicleQuestion): void {
    this.pendingQuestion = question;
    this.closeReviews();
  }
  protected afterReviewsClosed(): void {
    this.reviewContext.set(undefined);
    // The drawer restores focus before the host prepares the chat draft.
    const question = this.pendingQuestion;
    this.pendingQuestion = undefined;
    if (question) this.questionRequested.emit(question);
  }
  protected followUp(): void {
    const comparison = this.comparison();
    if (comparison)
      this.questionRequested.emit({
        kind: 'comparison',
        configurations: comparison.configurations,
        attributeCodes: this.rows().map((row) => row.attribute.code),
      });
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
