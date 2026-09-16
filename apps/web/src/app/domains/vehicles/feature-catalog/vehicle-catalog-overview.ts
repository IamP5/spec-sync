import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnChanges,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { form } from '@angular/forms/signals';

import {
  ZardDrawerComponent,
  ZardDrawerTitleComponent,
} from '@/ui/components/drawer';

import type {
  CatalogPage,
  VehicleConfiguration,
} from '../data/vehicle-contracts';
import type { VehicleQuestion } from '../data/vehicle-interactions';
import {
  filterAndSortConfigurations,
  MAX_SHORTLIST,
  modelSummaries,
  sortMode,
} from './catalog-presentation';
import { VehicleCatalogCard } from './ui/vehicle-catalog-card';
import { VehicleDetailPane } from './ui/vehicle-detail-pane';
import { VehicleCatalogDetailStore } from './vehicle-catalog-detail-store';
import { VehicleCatalogSearchStore } from './vehicle-catalog-search-store';

@Component({
  selector: 'app-vehicle-catalog-overview',
  imports: [
    VehicleCatalogCard,
    VehicleDetailPane,
    ZardDrawerComponent,
    ZardDrawerTitleComponent,
  ],
  providers: [VehicleCatalogSearchStore, VehicleCatalogDetailStore],
  templateUrl: './vehicle-catalog-overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
})
export class VehicleCatalogOverview implements OnChanges {
  readonly page = input<CatalogPage>();
  readonly failure = input<string>();
  readonly complete = input(false);
  readonly shortlist = input<VehicleConfiguration[] | undefined>();
  readonly shortlistChanged = output<VehicleConfiguration[]>();
  readonly questionRequested = output<VehicleQuestion>();
  readonly comparisonRequested = output<VehicleConfiguration[]>();

  private readonly searchStore = inject(VehicleCatalogSearchStore);
  private readonly detailStore = inject(VehicleCatalogDetailStore);
  protected readonly mobileScreen = toSignal(
    inject(BreakpointObserver).observe('(max-width: 767px)'),
    { initialValue: { matches: false, breakpoints: {} } },
  );
  protected readonly detailsOpen = signal(false);
  private pendingQuestion?: VehicleQuestion;

  protected readonly summaries = this.searchStore.highlights;
  protected readonly summariesLoading = this.searchStore.summariesIsLoading;
  protected readonly summariesError = this.searchStore.summariesError;
  protected readonly nextPageLoading = this.searchStore.nextPageIsPending;
  protected readonly nextPageFailed = this.searchStore.nextPageFailed;
  protected readonly detail = this.detailStore.detailValue;
  protected readonly detailLoading = this.detailStore.detailIsLoading;
  protected readonly detailError = this.detailStore.detailError;
  protected readonly focused = signal<VehicleConfiguration | undefined>(
    undefined,
  );

  protected readonly filters = signal({ query: '', sort: 'catalog-order' });
  protected readonly filterForm = form(this.filters);
  protected readonly searchQuery = computed(() => this.filters().query);
  protected readonly modelFilter = signal('all');
  protected readonly sortMode = computed(() => sortMode(this.filters().sort));
  protected readonly shortlistedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly shortlistMessage = signal('');
  /** The page as returned plus every continuation page loaded in place. */
  protected readonly configurations = computed(() => [
    ...(this.page()?.items ?? []),
    ...this.searchStore.continuation(),
  ]);
  /** What the card renders: the grown list and the paging that remains. */
  protected readonly view = computed<CatalogPage | undefined>(() => {
    const page = this.page();
    if (!page) return undefined;
    const nextSearches = this.searchStore.nextSearches();
    return {
      ...page,
      items: this.configurations(),
      hasMore: nextSearches.length > 0,
      limit:
        nextSearches.reduce((sum, search) => sum + search.limit, 0) ||
        page.limit,
    };
  });
  protected readonly modelSummaries = computed(() =>
    modelSummaries(this.configurations()),
  );
  protected readonly visibleConfigurations = computed(() =>
    filterAndSortConfigurations(
      this.configurations(),
      this.searchQuery(),
      this.modelFilter(),
      this.sortMode(),
      this.summaries(),
    ),
  );
  protected readonly shortlistedConfigurations = computed(
    () =>
      this.shortlist() ??
      this.configurations().filter((vehicle) =>
        this.shortlistedIds().has(vehicle.id),
      ),
  );
  protected readonly activeFilterCount = computed(
    () =>
      Number(this.searchQuery().trim().length > 0) +
      Number(this.modelFilter() !== 'all'),
  );

  /** Selecting the active model family again shows every family. */
  protected setModelFilter(model: string): void {
    this.modelFilter.set(this.modelFilter() === model ? 'all' : model);
  }

  protected clearFilters(): void {
    this.clearSearch();
    this.modelFilter.set('all');
  }

  protected toggleShortlist(vehicle: VehicleConfiguration): void {
    this.shortlistMessage.set('');
    const next = new Map(
      this.shortlistedConfigurations().map((item) => [item.id, item]),
    );
    if (next.has(vehicle.id)) next.delete(vehicle.id);
    else if (next.size < MAX_SHORTLIST) next.set(vehicle.id, vehicle);
    else {
      this.shortlistMessage.set(
        `Choose up to ${MAX_SHORTLIST} configurations for one comparison.`,
      );
      return;
    }
    const selected = [...next.values()];
    if (this.shortlist() === undefined)
      this.shortlistedIds.set(new Set(next.keys()));
    this.shortlistChanged.emit(selected);
  }

  protected clearSearch(): void {
    this.filters.update((filters) => ({ ...filters, query: '' }));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['page']) return;
    const page = this.page();
    if (page) this.searchStore.load(page);
  }

  protected openDetails(vehicle: VehicleConfiguration): void {
    this.pendingQuestion = undefined;
    this.focused.set(vehicle);
    this.detailStore.load(vehicle.id);
    this.detailsOpen.set(true);
  }

  protected closeDetails(): void {
    this.detailsOpen.set(false);
  }

  protected askAboutFocused(): void {
    const vehicle = this.focused();
    if (!vehicle) return;
    this.pendingQuestion = { kind: 'vehicle', vehicle };
    this.closeDetails();
  }

  protected afterDetailsClosed(): void {
    this.focused.set(undefined);
    // The drawer restores focus before the host prepares the chat draft.
    const question = this.pendingQuestion;
    this.pendingQuestion = undefined;
    if (question) this.questionRequested.emit(question);
  }

  protected compareShortlist(): void {
    const vehicles = this.shortlistedConfigurations();
    if (vehicles.length >= 2) this.comparisonRequested.emit(vehicles);
  }

  /** Loads the next page of the same search into this catalog. */
  protected requestNextPage(): void {
    this.searchStore.loadNextPage();
  }

  protected retrySummaries(): void {
    this.searchStore.retry();
  }

  protected retryDetail(): void {
    this.detailStore.retry();
  }
}
