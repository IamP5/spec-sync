import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCarFront, lucideCheck, lucidePlus } from '@ng-icons/lucide';

import { ZardSkeletonComponent } from '@/ui/components/skeleton';

import { VehicleCatalogItems } from './vehicle-catalog-items';

/**
 * The loaded page as a flush list in the reply column: one hairline row per
 * configuration with the key facts on the same line. Reads like part of the
 * reply and stays compact for large pages.
 */
@Component({
  selector: 'app-vehicle-catalog-list',
  imports: [NgIcon, ZardSkeletonComponent],
  viewProviders: [provideIcons({ lucideCarFront, lucideCheck, lucidePlus })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
  template: `
    <ul class="divide-y divide-border" role="list">
      @for (vehicle of vehicles(); track vehicle.id) {
        <li
          class="flex items-center gap-3 py-2.5"
          [attr.data-configuration-id]="vehicle.id"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            [attr.aria-label]="detailsLabel(vehicle)"
            (click)="vehicleSelected.emit(vehicle)"
          >
            <span
              class="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
              aria-label="Vehicle image not available"
            >
              <ng-icon name="lucideCarFront" aria-hidden="true" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-2">
                <span class="truncate font-medium"
                  >{{ vehicle.model }}
                  <span class="font-normal text-muted-foreground">{{
                    vehicle.name
                  }}</span></span
                >
                @if (identity(vehicle); as label) {
                  <span
                    class="shrink-0 rounded-full border border-border px-1.5 text-[10px] text-muted-foreground"
                    >{{ label }}</span
                  >
                }
              </span>
              <span class="mt-0.5 block truncate text-xs text-muted-foreground">
                {{ vehicle.brand }} · {{ vehicle.market }} ·
                {{ vehicle.modelYear }}
              </span>
            </span>
            <span
              class="hidden shrink-0 items-center gap-3 text-xs tabular-nums sm:flex"
            >
              @if (summariesLoading() && !summaries()) {
                <z-skeleton class="h-3 w-40" />
              } @else {
                @for (metric of metrics; track metric.code) {
                  <span
                    [class.text-muted-foreground]="
                      metric.code !== 'reference_price' ||
                      fact(vehicle, metric.code).status !== 'known'
                    "
                    [class.font-medium]="metric.code === 'reference_price'"
                    [class.text-warning]="
                      fact(vehicle, metric.code).status === 'conflicting'
                    "
                    >{{ fact(vehicle, metric.code).text }}</span
                  >
                }
              }
            </span>
          </button>
          <button
            type="button"
            class="grid size-8 shrink-0 place-items-center rounded-full border text-xs transition-colors"
            [class.border-border]="!isShortlisted(vehicle)"
            [class.text-muted-foreground]="!isShortlisted(vehicle)"
            [class.hover:bg-muted]="!isShortlisted(vehicle)"
            [class.border-primary]="isShortlisted(vehicle)"
            [class.bg-primary]="isShortlisted(vehicle)"
            [class.text-primary-foreground]="isShortlisted(vehicle)"
            [attr.data-action]="
              isShortlisted(vehicle) ? 'remove-shortlist' : 'add-shortlist'
            "
            [attr.aria-label]="shortlistLabel(vehicle)"
            [attr.aria-pressed]="isShortlisted(vehicle)"
            (click)="toggle($event, vehicle)"
          >
            <ng-icon
              [name]="isShortlisted(vehicle) ? 'lucideCheck' : 'lucidePlus'"
              aria-hidden="true"
            />
          </button>
        </li>
      }
    </ul>
  `,
})
export class VehicleCatalogList extends VehicleCatalogItems {}
