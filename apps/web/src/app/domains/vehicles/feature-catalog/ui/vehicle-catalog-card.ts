import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { type FieldTree, FormField } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideCarFront,
  lucideChevronDown,
  lucideChevronUp,
  lucideGalleryHorizontal,
  lucideList,
  lucideSearch,
  lucideX,
} from '@ng-icons/lucide';

import { ZardSkeletonComponent } from '@/ui/components/skeleton';
import { ZardIdDirective } from '@/ui/core';

import type {
  CatalogPage,
  Comparison,
  VehicleConfiguration,
} from '../../data/vehicle-contracts';
import {
  CATALOG_PAGE_STEP,
  defaultCatalogLayout,
  type ModelSummary,
} from '../catalog-presentation';
import { VehicleCatalogList } from './vehicle-catalog-list';
import { VehicleCatalogStrip } from './vehicle-catalog-strip';

/**
 * A catalog page attached to the reply instead of boxed in a card: a caption
 * with the counts, one hairline filter row, the configurations as a card
 * strip or a flush list (the reader can switch; large pages open as the
 * list), and a footer with the paging and the shortlist. Only a step of the
 * page is rendered at first so a large catalog never floods the transcript.
 */
@Component({
  selector: 'app-vehicle-catalog-card',
  hostDirectives: [ZardIdDirective],
  imports: [
    FormField,
    NgIcon,
    VehicleCatalogList,
    VehicleCatalogStrip,
    ZardSkeletonComponent,
  ],
  viewProviders: [
    provideIcons({
      lucideArrowRight,
      lucideCarFront,
      lucideChevronDown,
      lucideChevronUp,
      lucideGalleryHorizontal,
      lucideList,
      lucideSearch,
      lucideX,
    }),
  ],
  templateUrl: './vehicle-catalog-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
})
export class VehicleCatalogCard {
  private readonly uniqueId = inject(ZardIdDirective);
  protected readonly searchId = `${this.uniqueId.id()}-search`;
  protected readonly sortId = `${this.uniqueId.id()}-sort`;
  readonly page = input<CatalogPage>();
  readonly failure = input<string>();
  readonly complete = input(false);
  readonly summaries = input<Comparison>();
  readonly summariesLoading = input(false);
  readonly summariesError = input(false);
  readonly searchField = input.required<FieldTree<string>>();
  readonly sortField = input.required<FieldTree<string>>();
  readonly searchQuery = input('');
  readonly modelFilter = input('all');
  readonly shortlistedConfigurations = input<VehicleConfiguration[]>([]);
  readonly visibleConfigurations = input<VehicleConfiguration[]>([]);
  readonly modelSummaries = input<ModelSummary[]>([]);
  readonly activeFilterCount = input(0);
  readonly shortlistMessage = input('');
  readonly vehicleSelected = output<VehicleConfiguration>();
  readonly shortlistToggled = output<VehicleConfiguration>();
  readonly shortlistCompared = output<void>();
  readonly summariesRetried = output<void>();
  readonly modelChanged = output<string>();
  readonly filtersCleared = output<void>();
  readonly searchCleared = output<void>();
  readonly nextPageRequested = output<void>();

  /**
   * Presentation choice; follows the page size until the reader switches it.
   * Derived through a primitive computed so that a page object replaced by
   * the host (a re-parsed tool result) with the same size does not reset it.
   */
  private readonly pageSize = computed(() => this.page()?.items.length ?? 0);
  protected readonly layout = linkedSignal(() =>
    defaultCatalogLayout(this.pageSize()),
  );
  /** How many of the filtered configurations are rendered. */
  protected readonly limit = signal(CATALOG_PAGE_STEP);
  protected readonly shown = computed(() =>
    this.visibleConfigurations().slice(0, this.limit()),
  );
  protected readonly hidden = computed(() =>
    Math.max(0, this.visibleConfigurations().length - this.limit()),
  );
  protected readonly expanded = computed(
    () => this.limit() > CATALOG_PAGE_STEP,
  );
  /** How many more configurations the next "show more" reveals. */
  protected readonly step = computed(() =>
    Math.min(CATALOG_PAGE_STEP, this.hidden()),
  );
  /** Size of the next catalog page, offered once the loaded page is exhausted. */
  protected readonly nextPageSize = computed(() => {
    const page = this.page();
    return page?.hasMore && !this.hidden() ? page.limit : 0;
  });

  protected showMore(): void {
    this.limit.update((limit) => limit + this.step());
  }
  protected showLess(): void {
    this.limit.set(CATALOG_PAGE_STEP);
  }
  protected shortlistNames(): string {
    return this.shortlistedConfigurations()
      .map((vehicle) => `${vehicle.model} ${vehicle.name}`)
      .join(', ');
  }
}
