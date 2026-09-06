import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnChanges,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { AngularToolCall, ToolRenderer } from '@copilotkit/angular';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDownUp,
  lucideCarFront,
  lucideCheck,
  lucideChevronRight,
  lucideGitCompareArrows,
  lucideInfo,
  lucideLayoutList,
  lucidePanelRightOpen,
  lucideSearch,
  lucideSlidersHorizontal,
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardCardComponent } from '@/ui/components/card';
import { ZardDrawerRef, ZardDrawerService } from '@/ui/components/drawer';
import { ZardInputComponent } from '@/ui/components/input';
import { ZardSeparatorComponent } from '@/ui/components/separator';
import { ZardSkeletonComponent } from '@/ui/components/skeleton';

import {
  cellObservations,
  displayValue,
  parseResult,
} from '../data/vehicle-comparison';
import {
  catalogPageSchema,
  type Comparison,
  failureSchema,
  type VehicleConfiguration,
} from '../data/vehicle-contracts';
import { CHAT_CARD_ACTIONS } from './chat-card-actions';
import { VehicleCatalogDetailStore } from './vehicle-catalog-detail-store';
import { VehicleCatalogSearchStore } from './vehicle-catalog-search-store';
import { VehicleDetailPane } from './vehicle-detail-pane';

type CatalogView = 'catalog' | 'competitors';
type SortMode = 'catalog-order' | 'price-asc' | 'power-desc' | 'torque-desc';
type FactStatus = 'known' | 'not-reported' | 'conflicting';

interface CatalogFact {
  readonly text: string;
  readonly numeric?: number;
  readonly status: FactStatus;
}

interface ModelSummary {
  readonly brand: string;
  readonly model: string;
  readonly configurationCount: number;
}

const MAX_SHORTLIST = 5;

@Component({
  selector: 'app-vehicle-catalog-card',
  imports: [
    NgIcon,
    VehicleDetailPane,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardCardComponent,
    ZardInputComponent,
    ZardSeparatorComponent,
    ZardSkeletonComponent,
  ],
  providers: [VehicleCatalogSearchStore, VehicleCatalogDetailStore],
  viewProviders: [
    provideIcons({
      lucideArrowDownUp,
      lucideCarFront,
      lucideCheck,
      lucideChevronRight,
      lucideGitCompareArrows,
      lucideInfo,
      lucideLayoutList,
      lucidePanelRightOpen,
      lucideSearch,
      lucideSlidersHorizontal,
      lucideUsers,
      lucideX,
    }),
  ],
  templateUrl: './vehicle-catalog-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
})
export class VehicleCatalogCard
  implements ToolRenderer<Record<string, unknown>>, OnChanges
{
  readonly toolCall =
    input.required<AngularToolCall<Record<string, unknown>>>();

  private readonly searchStore = inject(VehicleCatalogSearchStore);
  private readonly detailStore = inject(VehicleCatalogDetailStore);
  private readonly drawer = inject(ZardDrawerService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly actions = inject(CHAT_CARD_ACTIONS, { optional: true });
  private readonly detailsTemplate =
    viewChild.required<TemplateRef<unknown>>('vehicleDetails');
  private detailsDrawer?: ZardDrawerRef<unknown>;

  protected readonly result = computed(() =>
    parseResult(this.toolCall().result, catalogPageSchema),
  );
  protected readonly error = computed(() =>
    parseResult(this.toolCall().result, failureSchema),
  );
  protected readonly summaries = this.searchStore.summariesValue;
  protected readonly summariesLoading = this.searchStore.summariesIsLoading;
  protected readonly summariesError = this.searchStore.summariesError;
  protected readonly detail = this.detailStore.detailValue;
  protected readonly detailLoading = this.detailStore.detailIsLoading;
  protected readonly detailError = this.detailStore.detailError;

  protected readonly catalogView = signal<CatalogView>('catalog');
  protected readonly searchQuery = signal('');
  protected readonly brandFilter = signal('all');
  protected readonly modelFilter = signal('all');
  protected readonly sortMode = signal<SortMode>('catalog-order');
  protected readonly shortlistedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly shortlistMessage = signal('');
  protected readonly focused = signal<VehicleConfiguration | undefined>(
    undefined,
  );

  protected readonly configurations = computed(
    () => this.result()?.items ?? [],
  );
  protected readonly brands = computed(() => [
    ...new Set(this.configurations().map((vehicle) => vehicle.brand)),
  ]);
  protected readonly modelSummaries = computed<ModelSummary[]>(() =>
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
  constructor() {
    inject(DestroyRef).onDestroy(() => this.detailsDrawer?.close());
  }

  ngOnChanges(): void {
    const page = this.result();
    if (page) this.searchStore.load(page.items.map(({ id }) => id));
  }

  protected setCatalogView(view: CatalogView): void {
    this.catalogView.set(view);
  }

  protected updateSearch(event: Event): void {
    if (event.target instanceof HTMLInputElement)
      this.searchQuery.set(event.target.value);
  }

  protected updateSort(event: Event): void {
    if (event.target instanceof HTMLSelectElement)
      this.sortMode.set(sortMode(event.target.value));
  }

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
    this.searchQuery.set('');
    this.brandFilter.set('all');
    this.modelFilter.set('all');
  }

  protected toggleShortlist(event: Event, vehicle: VehicleConfiguration): void {
    event.stopPropagation();
    this.shortlistMessage.set('');
    this.shortlistedIds.update((current) => {
      const next = new Set(current);
      if (next.has(vehicle.id)) next.delete(vehicle.id);
      else if (next.size < MAX_SHORTLIST) next.add(vehicle.id);
      else
        this.shortlistMessage.set(
          `Choose up to ${MAX_SHORTLIST} configurations for one comparison.`,
        );
      return next;
    });
  }

  protected isShortlisted(vehicle: VehicleConfiguration): boolean {
    return this.shortlistedIds().has(vehicle.id);
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
    if (!vehicle || !this.actions) return;
    const prompt = `Tell me more about ${vehicle.brand} ${vehicle.model} ${vehicle.name}, ${vehicle.market} ${vehicle.modelYear} (configuration ID ${vehicle.id}). Preserve unknowns, conflicts, qualifiers, and evidence.`;
    this.detailsDrawer?.close();
    setTimeout(() => this.actions?.draft(prompt), 220);
  }

  protected compareShortlist(): void {
    const vehicles = this.shortlistedConfigurations();
    if (vehicles.length < 2 || !this.actions) return;
    this.actions.send(
      `Compare these exact catalog configurations: ${vehicles
        .map(
          (vehicle) =>
            `${vehicle.brand} ${vehicle.model} ${vehicle.name} (${vehicle.id})`,
        )
        .join(
          '; ',
        )}. Use their configuration IDs and preserve missing, conflicting, optional, provisional, qualified, and dated facts.`,
    );
  }

  protected fact(vehicle: VehicleConfiguration, code: string): CatalogFact {
    return catalogFact(this.summaries(), vehicle.id, code);
  }

  protected metricPercent(
    vehicle: VehicleConfiguration,
    code: 'power_max' | 'torque_max',
  ): number {
    const values = this.shortlistedConfigurations()
      .map((item) => this.fact(item, code).numeric)
      .filter((value) => value !== undefined);
    const value = this.fact(vehicle, code).numeric;
    const maximum = Math.max(...values, 0);
    return value === undefined || maximum === 0
      ? 0
      : Math.round((value / maximum) * 100);
  }

  protected retrySummaries(): void {
    this.searchStore.retry();
  }

  protected retryDetail(): void {
    this.detailStore.retry();
  }
}

function modelSummaries(
  configurations: VehicleConfiguration[],
): ModelSummary[] {
  const summaries = new Map<string, ModelSummary>();
  for (const vehicle of configurations) {
    const current = summaries.get(vehicle.model);
    summaries.set(vehicle.model, {
      brand: vehicle.brand,
      model: vehicle.model,
      configurationCount: (current?.configurationCount ?? 0) + 1,
    });
  }
  return [...summaries.values()];
}

function filterAndSortConfigurations(
  configurations: VehicleConfiguration[],
  query: string,
  brand: string,
  model: string,
  sort: SortMode,
  summary: Comparison | undefined,
): VehicleConfiguration[] {
  const literal = query.trim().toLocaleLowerCase();
  const filtered = configurations.filter(
    (vehicle) =>
      (!literal ||
        `${vehicle.brand} ${vehicle.model} ${vehicle.name}`
          .toLocaleLowerCase()
          .includes(literal)) &&
      (brand === 'all' || vehicle.brand === brand) &&
      (model === 'all' || vehicle.model === model),
  );
  if (sort === 'catalog-order') return filtered;
  const [code, direction] =
    sort === 'price-asc'
      ? (['reference_price', 1] as const)
      : sort === 'power-desc'
        ? (['power_max', -1] as const)
        : (['torque_max', -1] as const);
  return filtered
    .map((vehicle, index) => ({ vehicle, index }))
    .sort((left, right) => {
      const a = catalogFact(summary, left.vehicle.id, code).numeric;
      const b = catalogFact(summary, right.vehicle.id, code).numeric;
      if (a === undefined && b === undefined) return left.index - right.index;
      if (a === undefined) return 1;
      if (b === undefined) return -1;
      return direction * (a - b) || left.index - right.index;
    })
    .map(({ vehicle }) => vehicle);
}

function catalogFact(
  comparison: Comparison | undefined,
  configurationId: string,
  code: string,
): CatalogFact {
  const row = comparison?.rows.find(
    (candidate) => candidate.attribute.code === code,
  );
  const cell = row?.cells.find(
    (candidate) => candidate.configurationId === configurationId,
  );
  if (!cell || cell.knowledgeStatus === 'NOT_REPORTED')
    return { text: 'Not reported', status: 'not-reported' };
  if (cell.knowledgeStatus === 'CONFLICTING')
    return { text: 'Conflicting', status: 'conflicting' };
  const observation = cellObservations(cell)[0];
  if (!observation) return { text: 'Not reported', status: 'not-reported' };
  if (observation.availability)
    return {
      text: availabilityLabel(observation.availability),
      status: 'known',
    };
  const numeric =
    typeof observation.value === 'number' ? observation.value : undefined;
  if (code === 'reference_price' && numeric !== undefined)
    return {
      text: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      }).format(numeric),
      numeric,
      status: 'known',
    };
  const value = displayValue(observation.value);
  return {
    text: `${value}${value && row?.attribute.unit ? ` ${row.attribute.unit}` : ''}`,
    numeric,
    status: 'known',
  };
}

function availabilityLabel(value: string): string {
  return (
    (
      {
        STANDARD: 'Standard',
        OPTIONAL: 'Optional',
        ABSENT: 'Absent',
        NOT_APPLICABLE: 'Not applicable',
      } as Record<string, string>
    )[value] ?? value
  );
}

function sortMode(value: string): SortMode {
  return value === 'price-asc' ||
    value === 'power-desc' ||
    value === 'torque-desc'
    ? value
    : 'catalog-order';
}
