import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { form } from '@angular/forms/signals';

import { ZardDialogRef, ZardDialogService } from '@/ui/components/dialog';

import { comparisonRows } from '../data/vehicle-comparison';
import type { Comparison } from '../data/vehicle-contracts';
import type {
  VehicleQuestion,
  VehicleReviewsContext,
} from '../data/vehicle-interactions';
import { VehicleReviewsSearch } from '../feature-reviews';
import { VehicleComparisonCard } from './ui/vehicle-comparison-card';

@Component({
  selector: 'app-vehicle-comparison-overview',
  imports: [VehicleComparisonCard, VehicleReviewsSearch],
  templateUrl: './vehicle-comparison-overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
})
export class VehicleComparisonOverview {
  readonly comparison = input<Comparison>();
  readonly failure = input<string>();
  readonly complete = input(false);
  readonly questionsEnabled = input(true);
  readonly questionRequested = output<VehicleQuestion>();
  private readonly dialog = inject(ZardDialogService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly reviewsTemplate =
    viewChild.required<TemplateRef<unknown>>('reviews');
  private reviewDialog?: ZardDialogRef;
  private questionTimer?: ReturnType<typeof setTimeout>;
  protected readonly reviewContext = signal<VehicleReviewsContext | undefined>(
    undefined,
  );
  protected readonly filters = signal({ query: '' });
  protected readonly filterForm = form(this.filters);
  protected readonly differencesOnly = signal(false);
  protected readonly rows = computed(() =>
    filterRows(this.comparison(), this.differencesOnly(), this.filters().query),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.reviewDialog?.close();
      clearTimeout(this.questionTimer);
    });
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
    this.reviewDialog?.close();
    this.reviewContext.set({ comparison, ...request });
    this.reviewDialog = this.dialog.create({
      zTitle: `Avaliações sobre ${request.row.attribute.label}`,
      zDescription:
        'Explore relatos, confira a origem e selecione evidências para conversar.',
      zContent: this.reviewsTemplate(),
      zViewContainerRef: this.viewContainerRef,
      zHideHeader: true,
      zHideFooter: true,
      zClosable: false,
      zWidth: '1120px',
      zDuration: 160,
      zCustomClasses:
        'specsync-review-dialog max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-3rem)] p-0 gap-0 overflow-hidden',
    });
  }
  protected closeReviews(): void {
    this.reviewDialog?.close();
  }
  protected finishReview(question: VehicleQuestion): void {
    this.closeReviews();
    // The host handles the intention after Zard restores the triggering element's focus.
    clearTimeout(this.questionTimer);
    this.questionTimer = setTimeout(
      () => this.questionRequested.emit(question),
      170,
    );
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
