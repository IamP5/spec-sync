import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { type FieldTree, FormField } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowDownUp,
  lucideCarFront,
  lucideCheck,
  lucideChevronRight,
  lucideGitCompareArrows,
  lucideInfo,
  lucideLayoutList,
  lucideSearch,
  lucideSlidersHorizontal,
  lucideUsers,
  lucideX,
} from '@ng-icons/lucide';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardCardComponent } from '@/ui/components/card';
import { ZardInputComponent } from '@/ui/components/input';
import { ZardSeparatorComponent } from '@/ui/components/separator';
import { ZardSkeletonComponent } from '@/ui/components/skeleton';
import { ZardIdDirective } from '@/ui/core';

import type {
  CatalogPage,
  Comparison,
  VehicleConfiguration,
} from '../../data/vehicle-contracts';
import {
  catalogFact,
  type CatalogView,
  type ModelSummary,
} from '../catalog-presentation';

@Component({
  selector: 'app-vehicle-catalog-card',
  hostDirectives: [ZardIdDirective],
  imports: [
    NgIcon,
    FormField,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardCardComponent,
    ZardInputComponent,
    ZardSeparatorComponent,
    ZardSkeletonComponent,
  ],
  viewProviders: [
    provideIcons({
      lucideArrowDownUp,
      lucideCarFront,
      lucideCheck,
      lucideChevronRight,
      lucideGitCompareArrows,
      lucideInfo,
      lucideLayoutList,
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
export class VehicleCatalogCard {
  private readonly uniqueId = inject(ZardIdDirective);
  protected readonly searchId = `${this.uniqueId.id()}-search`;
  protected readonly sortId = `${this.uniqueId.id()}-sort`;
  protected readonly sortPanelId = `${this.uniqueId.id()}-sort-panel`;
  protected readonly modelsPanelId = `${this.uniqueId.id()}-models-panel`;
  protected readonly filtersExpanded = signal(false);
  readonly page = input<CatalogPage>();
  readonly failure = input<string>();
  readonly complete = input(false);
  readonly summaries = input<Comparison>();
  readonly summariesLoading = input(false);
  readonly summariesError = input(false);
  readonly searchField = input.required<FieldTree<string>>();
  readonly sortField = input.required<FieldTree<string>>();
  readonly searchQuery = input('');
  readonly brandFilter = input('all');
  readonly modelFilter = input('all');
  readonly shortlistedConfigurations = input<VehicleConfiguration[]>([]);
  readonly visibleConfigurations = input<VehicleConfiguration[]>([]);
  readonly brands = input<string[]>([]);
  readonly modelSummaries = input<ModelSummary[]>([]);
  readonly activeFilterCount = input(0);
  readonly shortlistMessage = input('');
  readonly catalogView = signal<CatalogView>('catalog');
  readonly vehicleSelected = output<VehicleConfiguration>();
  readonly shortlistToggled = output<VehicleConfiguration>();
  readonly shortlistCompared = output<void>();
  readonly summariesRetried = output<void>();
  readonly brandChanged = output<string>();
  readonly modelChanged = output<string>();
  readonly filtersCleared = output<void>();
  readonly searchCleared = output<void>();

  protected isShortlisted(vehicle: VehicleConfiguration): boolean {
    return this.shortlistedConfigurations().some(({ id }) => id === vehicle.id);
  }
  protected toggleShortlist(event: Event, vehicle: VehicleConfiguration): void {
    event.stopPropagation();
    this.shortlistToggled.emit(vehicle);
  }
  protected fact(vehicle: VehicleConfiguration, code: string) {
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
}
