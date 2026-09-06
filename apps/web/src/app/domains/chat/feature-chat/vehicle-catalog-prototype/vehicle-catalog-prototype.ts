import { NgOptimizedImage, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  isDevMode,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDownUp,
  lucideArrowLeft,
  lucideArrowRight,
  lucideArrowUp,
  lucideBadgeCheck,
  lucideCheck,
  lucideChevronRight,
  lucideCircleAlert,
  lucideCircleHelp,
  lucideGitCompareArrows,
  lucideInfo,
  lucideLayoutList,
  lucideMessageCircle,
  lucidePanelRightOpen,
  lucideSearch,
  lucideSlidersHorizontal,
  lucideSparkles,
  lucideTrophy,
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import {
  ZardCardComponent,
  ZardCardContentComponent,
  ZardCardDescriptionComponent,
  ZardCardFooterComponent,
  ZardCardHeaderComponent,
  ZardCardTitleComponent,
} from '@/ui/components/card';
import { ZardDialogService } from '@/ui/components/dialog';
import { ZardInputComponent } from '@/ui/components/input';
import { ZardSeparatorComponent } from '@/ui/components/separator';
import { ZardSheetService } from '@/ui/components/sheet';
import { ZardTabsImports } from '@/ui/components/tabs';
import { ZardTextareaComponent } from '@/ui/components/textarea';

type PrototypeVariant = 'A' | 'B' | 'C';
type KnowledgeStatus = 'known' | 'not-reported' | 'conflicting';
type CatalogView = 'catalog' | 'competitors';
type SortMode = 'recommended' | 'price-asc' | 'power-desc' | 'torque-desc';

interface VehicleSpec {
  readonly label: string;
  readonly value: string;
  readonly status: KnowledgeStatus;
  readonly note?: string;
}

interface PrototypeVehicle {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
  readonly configuration: string;
  readonly year: number;
  readonly market: string;
  readonly imageUrl: string;
  readonly imageAlt: string;
  readonly imagePosition?: string;
  readonly identity: 'resolved' | 'provisional';
  readonly price?: string;
  readonly summary: string;
  readonly specs: readonly VehicleSpec[];
}

interface VariantDefinition {
  readonly key: PrototypeVariant;
  readonly name: string;
  readonly interaction: string;
}

interface ModelSummary {
  readonly brand: string;
  readonly model: string;
  readonly configurationCount: number;
  readonly imageUrl: string;
  readonly imageAlt: string;
  readonly strongestPower: string;
}

const VARIANTS: readonly VariantDefinition[] = [
  {
    key: 'A',
    name: 'Conversation cards',
    interaction: 'Horizontal catalog + focused dialog',
  },
  {
    key: 'B',
    name: 'Decision list',
    interaction: 'Dense comparison rows + right sheet',
  },
  {
    key: 'C',
    name: 'Research workspace',
    interaction: 'Persistent split view + live composer',
  },
];

const FORD_IMAGE =
  'https://img.pikbest.com/wp/202409/pickup-truck-white-background-showcases-3d-rendering-of-a-sharp-blue_9856180.jpg%21sw800';
const LIGHT_PICKUP_IMAGE =
  'https://img.pikbest.com/wp/202347/pickup-truck-3d-render-of-white-background-with-a-stunning-red_9767453.jpg%21sw800';
const BLUE_PICKUP_IMAGE =
  'https://img.pikbest.com/wp/202409/pickup-truck-white-background-showcases-3d-rendering-of-a-sharp-blue_9856180.jpg%21sw800';
const DARK_PICKUP_IMAGE =
  'https://img.pikbest.com/wp/202405/pickup-truck-sleek-black-displayed-on-a-dark-backdrop-in-3d_9852358.jpg%21sw800';

const VEHICLES: readonly PrototypeVehicle[] = [
  {
    id: '08e08761-a2e7-5ae5-b2ad-387e93829fb7',
    brand: 'Ford',
    model: 'Ranger',
    configuration: 'Black 2.0 AT Diesel',
    year: 2026,
    market: 'BR',
    imageUrl: FORD_IMAGE,
    imageAlt: 'Illustrative blue double-cab pickup in a studio',
    identity: 'provisional',
    price: 'R$ 242.600',
    summary: '170 cv · 405 Nm · automatic 6-speed',
    specs: [
      { label: 'Engine', value: '2.0 turbo diesel', status: 'known' },
      { label: 'Power', value: '170 cv', status: 'known' },
      { label: 'Torque', value: '405 Nm', status: 'known' },
      {
        label: 'Drivetrain',
        value: 'Conflicting',
        status: 'conflicting',
        note: 'The curated catalog and website notes disagree: 4x4 versus 4x2.',
      },
      { label: 'Transmission', value: 'Automatic · 6-speed', status: 'known' },
      { label: 'Payload', value: 'Not reported', status: 'not-reported' },
      { label: 'Fuel tank', value: '80 L', status: 'known' },
      { label: 'Length', value: '5,370 mm', status: 'known' },
      { label: 'Wheelbase', value: '3,270 mm', status: 'known' },
      {
        label: 'Adaptive cruise',
        value: 'Not reported',
        status: 'not-reported',
      },
      { label: '360° camera', value: 'Not reported', status: 'not-reported' },
      { label: 'Sunroof', value: 'Not reported', status: 'not-reported' },
    ],
  },
  {
    id: 'f94a2350-0a1a-5ad3-aef8-3c0c472c72a1',
    brand: 'Ford',
    model: 'Ranger',
    configuration: 'Limited 3.0 V6 AT Diesel',
    year: 2026,
    market: 'BR',
    imageUrl: FORD_IMAGE,
    imageAlt: 'Illustrative blue double-cab pickup in a studio',
    imagePosition: 'center 62%',
    identity: 'resolved',
    price: 'R$ 346.900',
    summary: '250 cv · 600 Nm · 4WD',
    specs: [
      { label: 'Engine', value: '3.0 V6 turbo diesel', status: 'known' },
      { label: 'Power', value: '250 cv', status: 'known' },
      { label: 'Torque', value: '600 Nm', status: 'known' },
      { label: 'Drivetrain', value: '4WD', status: 'known' },
      { label: 'Transmission', value: 'Automatic · 10-speed', status: 'known' },
      { label: 'Payload', value: 'Not reported', status: 'not-reported' },
      { label: 'Fuel tank', value: '80 L', status: 'known' },
      { label: 'Length', value: '5,370 mm', status: 'known' },
      { label: 'Wheelbase', value: '3,270 mm', status: 'known' },
      { label: 'Adaptive cruise', value: 'Optional package', status: 'known' },
      { label: '360° camera', value: 'Optional package', status: 'known' },
      { label: 'Sunroof', value: 'Not reported', status: 'not-reported' },
    ],
  },
  {
    id: 'c28c64e4-801a-5d29-b4c2-083a888a79f3',
    brand: 'Toyota',
    model: 'Hilux',
    configuration: 'SRX Plus 2.8 AT Diesel',
    year: 2026,
    market: 'BR',
    imageUrl: LIGHT_PICKUP_IMAGE,
    imageAlt: 'Illustrative red double-cab pickup in a studio',
    identity: 'resolved',
    summary: '204 cv · 499 Nm · 1,005 kg payload',
    specs: [
      { label: 'Engine', value: '2.8L 16V turbo intercooler', status: 'known' },
      { label: 'Power', value: '204 cv', status: 'known' },
      { label: 'Torque', value: '499 Nm', status: 'known' },
      { label: 'Drivetrain', value: 'Not reported', status: 'not-reported' },
      { label: 'Transmission', value: 'Automatic · 6-speed', status: 'known' },
      { label: 'Payload', value: '1,005 kg', status: 'known' },
      { label: 'Fuel tank', value: '80 L', status: 'known' },
      { label: 'Length', value: '5,325 mm', status: 'known' },
      { label: 'Wheelbase', value: '3,085 mm', status: 'known' },
      { label: 'Adaptive cruise', value: 'Standard', status: 'known' },
      {
        label: '360° camera',
        value: 'Conflicting',
        status: 'conflicting',
        note: 'The explicit camera table says absent; the trim summary implies it is retained.',
      },
      { label: 'Sunroof', value: 'Not reported', status: 'not-reported' },
    ],
  },
  {
    id: '014f2d31-f3ec-583a-996d-5696020d0c14',
    brand: 'Nissan',
    model: 'Frontier',
    configuration: 'Platinum 2.3 AT Diesel',
    year: 2026,
    market: 'BR',
    imageUrl: BLUE_PICKUP_IMAGE,
    imageAlt: 'Illustrative blue double-cab pickup in a studio',
    identity: 'resolved',
    price: 'R$ 317.990',
    summary: '190 cv · 450 Nm · 4x4',
    specs: [
      { label: 'Engine', value: '2.3L 16V bi-turbo diesel', status: 'known' },
      { label: 'Power', value: '190 cv', status: 'known' },
      { label: 'Torque', value: '450 Nm', status: 'known' },
      { label: 'Drivetrain', value: '4x4', status: 'known' },
      { label: 'Transmission', value: 'Automatic · 7-speed', status: 'known' },
      { label: 'Payload', value: '1,010 kg', status: 'known' },
      { label: 'Fuel tank', value: 'Not reported', status: 'not-reported' },
      { label: 'Length', value: '5,262 mm', status: 'known' },
      { label: 'Wheelbase', value: '3,150 mm', status: 'known' },
      {
        label: 'Adaptive cruise',
        value: 'Not reported',
        status: 'not-reported',
      },
      { label: '360° camera', value: 'Standard', status: 'known' },
      { label: 'Sunroof', value: 'Standard', status: 'known' },
    ],
  },
  {
    id: '284db245-6895-50c6-a15e-aee0dacaa108',
    brand: 'Nissan',
    model: 'Frontier',
    configuration: 'PRO-4X 2.3 AT Diesel',
    year: 2026,
    market: 'BR',
    imageUrl: DARK_PICKUP_IMAGE,
    imageAlt: 'Illustrative black double-cab pickup in a dark studio',
    identity: 'resolved',
    price: 'R$ 317.990',
    summary: '190 cv · 450 Nm · 4x4',
    specs: [
      { label: 'Engine', value: '2.3L 16V bi-turbo diesel', status: 'known' },
      { label: 'Power', value: '190 cv', status: 'known' },
      { label: 'Torque', value: '450 Nm', status: 'known' },
      { label: 'Drivetrain', value: '4x4', status: 'known' },
      { label: 'Transmission', value: 'Automatic · 7-speed', status: 'known' },
      { label: 'Payload', value: '1,010 kg', status: 'known' },
      { label: 'Fuel tank', value: 'Not reported', status: 'not-reported' },
      { label: 'Length', value: '5,262 mm', status: 'known' },
      { label: 'Wheelbase', value: '3,150 mm', status: 'known' },
      {
        label: 'Adaptive cruise',
        value: 'Not reported',
        status: 'not-reported',
      },
      { label: '360° camera', value: 'Standard', status: 'known' },
      { label: 'Sunroof', value: 'Absent', status: 'known' },
    ],
  },
];

/**
 * PROTOTYPE ONLY — three vehicle-catalog experiences on one route, switchable
 * with `?variant=A|B|C`. It uses the current ontology as in-memory fixture data.
 */
@Component({
  selector: 'app-vehicle-catalog-prototype',
  imports: [
    NgIcon,
    NgOptimizedImage,
    NgTemplateOutlet,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardCardComponent,
    ZardCardContentComponent,
    ZardCardDescriptionComponent,
    ZardCardFooterComponent,
    ZardCardHeaderComponent,
    ZardCardTitleComponent,
    ZardInputComponent,
    ZardSeparatorComponent,
    ...ZardTabsImports,
    ZardTextareaComponent,
  ],
  providers: [
    provideIcons({
      lucideArrowDownUp,
      lucideArrowLeft,
      lucideArrowRight,
      lucideArrowUp,
      lucideBadgeCheck,
      lucideCheck,
      lucideChevronRight,
      lucideCircleAlert,
      lucideCircleHelp,
      lucideGitCompareArrows,
      lucideInfo,
      lucideLayoutList,
      lucideMessageCircle,
      lucidePanelRightOpen,
      lucideSearch,
      lucideSlidersHorizontal,
      lucideSparkles,
      lucideTrophy,
      lucideUsers,
      lucideX,
    }),
  ],
  templateUrl: './vehicle-catalog-prototype.html',
  styleUrl: './vehicle-catalog-prototype.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block h-svh min-h-0 bg-background',
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
})
export class VehicleCatalogPrototype {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(ZardDialogService);
  private readonly sheet = inject(ZardSheetService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly detailsTemplate =
    viewChild.required<TemplateRef<unknown>>('vehicleDetails');

  protected readonly variants = VARIANTS;
  protected readonly vehicles = VEHICLES;
  protected readonly development = isDevMode();
  protected readonly variant = signal<PrototypeVariant>(
    normalizeVariant(this.route.snapshot.queryParamMap.get('variant')),
  );
  protected readonly focusedVehicle = signal<PrototypeVehicle>(
    vehicleFromId(this.route.snapshot.queryParamMap.get('vehicle')),
  );
  protected readonly comparedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly draft = signal('');
  protected readonly catalogView = signal<CatalogView>('catalog');
  protected readonly searchQuery = signal('');
  protected readonly brandFilter = signal('all');
  protected readonly modelFilter = signal('all');
  protected readonly sortMode = signal<SortMode>('recommended');
  protected readonly brands = ['Ford', 'Toyota', 'Nissan'] as const;
  protected readonly assumedSegment = 'Midsize pickup';
  protected readonly currentVariant = computed(
    () => VARIANTS.find(({ key }) => key === this.variant()) ?? VARIANTS[0],
  );
  protected readonly knownCount = computed(
    () =>
      this.focusedVehicle().specs.filter(({ status }) => status === 'known')
        .length,
  );
  protected readonly uncertainCount = computed(
    () => this.focusedVehicle().specs.length - this.knownCount(),
  );
  protected readonly modelSummaries = computed<readonly ModelSummary[]>(() =>
    ['Ranger', 'Hilux', 'Frontier'].map((model) => {
      const configurations = this.vehicles.filter(
        (vehicle) => vehicle.model === model,
      );
      const representative = configurations[0];
      const strongest = configurations.reduce((current, vehicle) =>
        numericSpec(vehicle, 'Power') > numericSpec(current, 'Power')
          ? vehicle
          : current,
      );
      return {
        brand: representative.brand,
        model,
        configurationCount: configurations.length,
        imageUrl: representative.imageUrl,
        imageAlt: representative.imageAlt,
        strongestPower: specValue(strongest, 'Power'),
      };
    }),
  );
  protected readonly visibleVehicles = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase();
    const vehicles = this.vehicles.filter((vehicle) => {
      const matchesQuery =
        query.length === 0 ||
        `${vehicle.brand} ${vehicle.model} ${vehicle.configuration}`
          .toLocaleLowerCase()
          .includes(query);
      const matchesBrand =
        this.brandFilter() === 'all' || vehicle.brand === this.brandFilter();
      const matchesModel =
        this.modelFilter() === 'all' || vehicle.model === this.modelFilter();
      return matchesQuery && matchesBrand && matchesModel;
    });

    return [...vehicles].sort((left, right) => {
      switch (this.sortMode()) {
        case 'price-asc':
          return priceValue(left) - priceValue(right);
        case 'power-desc':
          return numericSpec(right, 'Power') - numericSpec(left, 'Power');
        case 'torque-desc':
          return numericSpec(right, 'Torque') - numericSpec(left, 'Torque');
        default:
          return this.vehicles.indexOf(left) - this.vehicles.indexOf(right);
      }
    });
  });
  protected readonly activeFilterCount = computed(
    () =>
      Number(this.searchQuery().trim().length > 0) +
      Number(this.brandFilter() !== 'all') +
      Number(this.modelFilter() !== 'all'),
  );
  protected readonly competitorVehicles = computed(() => {
    const shortlist = this.vehicles.filter((vehicle) =>
      this.comparedIds().has(vehicle.id),
    );
    if (shortlist.length >= 2) return shortlist;

    const selected = this.focusedVehicle();
    return ['Ranger', 'Hilux', 'Frontier'].map((model) => {
      if (selected.model === model) return selected;
      return (
        this.vehicles.find(
          (vehicle) =>
            vehicle.model === model &&
            (vehicle.configuration.includes('Limited') ||
              vehicle.configuration.includes('SRX') ||
              vehicle.configuration.includes('Platinum')),
        ) ??
        this.vehicles.find((vehicle) => vehicle.model === model) ??
        VEHICLES[0]
      );
    });
  });
  protected readonly maxCompetitorPower = computed(() =>
    Math.max(
      ...this.competitorVehicles().map((vehicle) =>
        numericSpec(vehicle, 'Power'),
      ),
    ),
  );
  protected readonly maxCompetitorTorque = computed(() =>
    Math.max(
      ...this.competitorVehicles().map((vehicle) =>
        numericSpec(vehicle, 'Torque'),
      ),
    ),
  );
  protected readonly prototypeState = computed(
    () =>
      `variant=${this.variant()} · selected=${this.focusedVehicle().brand} ${this.focusedVehicle().model} · compared=${this.comparedIds().size}`,
  );

  protected selectVehicle(vehicle: PrototypeVehicle): void {
    this.focusedVehicle.set(vehicle);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { vehicle: vehicle.id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected openDialog(vehicle: PrototypeVehicle): void {
    this.selectVehicle(vehicle);
    this.dialog.create({
      zTitle: `${vehicle.brand} ${vehicle.model}`,
      zDescription: `${vehicle.configuration}, model year ${vehicle.year}`,
      zContent: this.detailsTemplate(),
      zHideFooter: true,
      zHideHeader: true,
      zViewContainerRef: this.viewContainerRef,
      zWidth: 'min(56rem, calc(100vw - 2rem))',
      zCustomClasses: 'max-h-[calc(100svh-2rem)] overflow-y-auto p-0',
    });
  }

  protected openSheet(vehicle: PrototypeVehicle): void {
    this.selectVehicle(vehicle);
    this.sheet.create({
      zTitle: `${vehicle.brand} ${vehicle.model}`,
      zDescription: `${vehicle.configuration} · ${vehicle.market} ${vehicle.year}`,
      zContent: this.detailsTemplate(),
      zHideFooter: true,
      zSide: 'right',
      zViewContainerRef: this.viewContainerRef,
      zWidth: 'min(38rem, 100vw)',
      zCustomClasses: 'gap-0 overflow-y-auto',
    });
  }

  protected toggleComparison(event: Event, vehicle: PrototypeVehicle): void {
    event.stopPropagation();
    this.comparedIds.update((current) => {
      const next = new Set(current);
      if (next.has(vehicle.id)) next.delete(vehicle.id);
      else next.add(vehicle.id);
      return next;
    });
  }

  protected isCompared(vehicle: PrototypeVehicle): boolean {
    return this.comparedIds().has(vehicle.id);
  }

  protected askAbout(vehicle: PrototypeVehicle): void {
    this.draft.set(
      `Tell me more about the ${vehicle.brand} ${vehicle.model} ${vehicle.configuration}.`,
    );
  }

  protected updateDraft(event: Event): void {
    if (event.target instanceof HTMLTextAreaElement) {
      this.draft.set(event.target.value);
    }
  }

  protected setCatalogView(view: CatalogView): void {
    this.catalogView.set(view);
  }

  protected updateSearch(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.searchQuery.set(event.target.value);
    }
  }

  protected setBrandFilter(brand: string): void {
    this.brandFilter.set(brand);
    if (
      this.modelFilter() !== 'all' &&
      !this.vehicles.some(
        (vehicle) =>
          vehicle.brand === brand && vehicle.model === this.modelFilter(),
      )
    ) {
      this.modelFilter.set('all');
    }
  }

  protected setModelFilter(model: string): void {
    this.modelFilter.set(this.modelFilter() === model ? 'all' : model);
    if (this.modelFilter() !== 'all') {
      const vehicle = this.vehicles.find(
        (candidate) => candidate.model === this.modelFilter(),
      );
      if (vehicle) this.brandFilter.set(vehicle.brand);
    }
  }

  protected updateSort(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      this.sortMode.set(normalizeSortMode(event.target.value));
    }
  }

  protected clearFilters(): void {
    this.searchQuery.set('');
    this.brandFilter.set('all');
    this.modelFilter.set('all');
  }

  protected resetComparison(): void {
    this.comparedIds.set(new Set());
  }

  protected brandCount(brand: string): number {
    return this.vehicles.filter((vehicle) => vehicle.brand === brand).length;
  }

  protected specValue(vehicle: PrototypeVehicle, label: string): string {
    return specValue(vehicle, label);
  }

  protected metricPercent(
    vehicle: PrototypeVehicle,
    label: 'Power' | 'Torque',
  ): number {
    const max =
      label === 'Power'
        ? this.maxCompetitorPower()
        : this.maxCompetitorTorque();
    return Math.round((numericSpec(vehicle, label) / max) * 100);
  }

  protected isMetricLeader(
    vehicle: PrototypeVehicle,
    label: 'Power' | 'Torque',
  ): boolean {
    const max =
      label === 'Power'
        ? this.maxCompetitorPower()
        : this.maxCompetitorTorque();
    return numericSpec(vehicle, label) === max;
  }

  protected setVariant(variant: PrototypeVariant): void {
    this.variant.set(variant);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { variant },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected cycleVariant(direction: -1 | 1): void {
    const currentIndex = VARIANTS.findIndex(
      ({ key }) => key === this.variant(),
    );
    const nextIndex =
      (currentIndex + direction + VARIANTS.length) % VARIANTS.length;
    this.setVariant(VARIANTS[nextIndex].key);
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    ) {
      return;
    }
    event.preventDefault();
    this.cycleVariant(event.key === 'ArrowLeft' ? -1 : 1);
  }
}

function normalizeVariant(value: string | null): PrototypeVariant {
  return value === 'B' || value === 'C' ? value : 'A';
}

function vehicleFromId(id: string | null): PrototypeVehicle {
  return VEHICLES.find((vehicle) => vehicle.id === id) ?? VEHICLES[0];
}

function normalizeSortMode(value: string): SortMode {
  if (
    value === 'price-asc' ||
    value === 'power-desc' ||
    value === 'torque-desc'
  ) {
    return value;
  }
  return 'recommended';
}

function specValue(vehicle: PrototypeVehicle, label: string): string {
  return vehicle.specs.find((spec) => spec.label === label)?.value ?? '—';
}

function numericSpec(vehicle: PrototypeVehicle, label: string): number {
  const value = specValue(vehicle, label).replace(',', '.');
  return Number.parseFloat(value.replace(/[^\d.]/g, '')) || 0;
}

function priceValue(vehicle: PrototypeVehicle): number {
  if (!vehicle.price) return Number.POSITIVE_INFINITY;
  return Number.parseInt(vehicle.price.replace(/\D/g, ''), 10);
}
