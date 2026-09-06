import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnChanges,
  output,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { form } from '@angular/forms/signals';

import { ZardDrawerRef, ZardDrawerService } from '@/ui/components/drawer';

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
  imports: [VehicleCatalogCard, VehicleDetailPane],
  providers: [VehicleCatalogSearchStore, VehicleCatalogDetailStore],
  templateUrl: './vehicle-catalog-overview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
})
export class VehicleCatalogOverview implements OnChanges {
  readonly page = input<CatalogPage>();
  readonly failure = input<string>();
  readonly complete = input(false);
  readonly questionRequested = output<VehicleQuestion>();
  readonly comparisonRequested = output<VehicleConfiguration[]>();

  private readonly searchStore = inject(VehicleCatalogSearchStore);
  private readonly detailStore = inject(VehicleCatalogDetailStore);
  private readonly drawer = inject(ZardDrawerService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly detailsTemplate =
    viewChild.required<TemplateRef<unknown>>('vehicleDetails');
  private detailsDrawer?: ZardDrawerRef<unknown>;

  protected readonly summaries = this.searchStore.summariesValue;
  protected readonly summariesLoading = this.searchStore.summariesIsLoading;
  protected readonly summariesError = this.searchStore.summariesError;
  protected readonly detail = this.detailStore.detailValue;
  protected readonly detailLoading = this.detailStore.detailIsLoading;
  protected readonly detailError = this.detailStore.detailError;
  protected readonly focused = signal<VehicleConfiguration | undefined>(
    undefined,
  );

  protected readonly filters = signal({ query: '', sort: 'catalog-order' });
  protected readonly filterForm = form(this.filters);
  protected readonly searchQuery = computed(() => this.filters().query);
  protected readonly brandFilter = signal('all');
  protected readonly modelFilter = signal('all');
  protected readonly sortMode = computed(() => sortMode(this.filters().sort));
  protected readonly shortlistedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly shortlistMessage = signal('');
  protected readonly configurations = computed(() => this.page()?.items ?? []);
  protected readonly brands = computed(() => [
    ...new Set(this.configurations().map((vehicle) => vehicle.brand)),
  ]);
  protected readonly modelSummaries = computed(() =>
    modelSummaries(this.configurations()),
  );
  protected readonly visibleConfigurations = computed(() =>
    filterAndSortConfigurations(
      this.configurations(),
      this.searchQuery(),
      this.brandFilter(),
      this.modelFilter(),
      this.sortMode(),
      this.summaries(),
    ),
  );
  protected readonly shortlistedConfigurations = computed(() =>
    this.configurations().filter((vehicle) =>
      this.shortlistedIds().has(vehicle.id),
    ),
  );
  protected readonly activeFilterCount = computed(
    () =>
      Number(this.searchQuery().trim().length > 0) +
      Number(this.brandFilter() !== 'all') +
      Number(this.modelFilter() !== 'all'),
  );
  protected setBrandFilter(brand: string): void {
    this.brandFilter.set(brand);
    if (
      brand !== 'all' &&
      !this.configurations().some(
        (vehicle) =>
          vehicle.brand === brand && vehicle.model === this.modelFilter(),
      )
    )
      this.modelFilter.set('all');
  }

  protected setModelFilter(model: string): void {
    const next = this.modelFilter() === model ? 'all' : model;
    this.modelFilter.set(next);
    if (next !== 'all') {
      const vehicle = this.configurations().find(
        (configuration) => configuration.model === next,
      );
      if (vehicle) this.brandFilter.set(vehicle.brand);
    }
  }

  protected clearFilters(): void {
    this.clearSearch();
    this.brandFilter.set('all');
    this.modelFilter.set('all');
  }

  protected toggleShortlist(vehicle: VehicleConfiguration): void {
    this.shortlistMessage.set('');
    const next = new Set(this.shortlistedIds());
    if (next.has(vehicle.id)) next.delete(vehicle.id);
    else if (next.size < MAX_SHORTLIST) next.add(vehicle.id);
    else {
      this.shortlistMessage.set(
        `Choose up to ${MAX_SHORTLIST} configurations for one comparison.`,
      );
      return;
    }
    this.shortlistedIds.set(next);
  }

  protected clearSearch(): void {
    this.filters.update((filters) => ({ ...filters, query: '' }));
  }

  private questionTimer?: ReturnType<typeof setTimeout>;
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.detailsDrawer?.close();
      clearTimeout(this.questionTimer);
    });
  }

  ngOnChanges(): void {
    const page = this.page();
    if (page) this.searchStore.load(page.items.map(({ id }) => id));
  }

  protected openDetails(vehicle: VehicleConfiguration): void {
    this.focused.set(vehicle);
    this.detailStore.load(vehicle.id);
    this.detailsDrawer?.close();
    this.detailsDrawer = this.drawer.create({
      zTitle: `${vehicle.brand} ${vehicle.model} ${vehicle.name}`,
      zDescription: `Catalog details for ${vehicle.market} ${vehicle.modelYear}`,
      zContent: this.detailsTemplate(),
      zClosable: false,
      zDuration: 260,
      zHideFooter: true,
      zPlacement: 'right',
      zViewContainerRef: this.viewContainerRef,
      zCustomClasses:
        'h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)]! sm:w-[min(42rem,calc(100vw-1rem))]! [&_[data-slot=drawer-header]]:sr-only [&_[data-slot=drawer-content]_main]:gap-0 [&_[data-slot=drawer-content]_main]:overflow-hidden [&_[data-slot=drawer-content]_main]:p-0',
    });
  }

  protected closeDetails(): void {
    this.detailsDrawer?.close();
  }

  protected askAboutFocused(): void {
    const vehicle = this.focused();
    if (!vehicle) return;
    this.closeDetails();
    // Let the drawer restore focus before its host handles the question.
    clearTimeout(this.questionTimer);
    this.questionTimer = setTimeout(
      () => this.questionRequested.emit({ kind: 'vehicle', vehicle }),
      270,
    );
  }

  protected compareShortlist(): void {
    const vehicles = this.shortlistedConfigurations();
    if (vehicles.length >= 2) this.comparisonRequested.emit(vehicles);
  }

  protected retrySummaries(): void {
    this.searchStore.retry();
  }

  protected retryDetail(): void {
    this.detailStore.retry();
  }
}
