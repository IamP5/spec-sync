import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideCarFront,
  lucideCheck,
  lucidePlus,
} from '@ng-icons/lucide';

import { ZardSkeletonComponent } from '@/ui/components/skeleton';

import { VehicleCatalogItems } from './vehicle-catalog-items';

/**
 * The loaded page as a horizontal strip of compact cards that bleeds past
 * the reply column; the scrollbar is hidden (wheel, trackpad and touch still
 * scroll it). The strip ends with a card that reveals the next step of the
 * page or asks for the next catalog page, so it never grows on its own.
 */
@Component({
  selector: 'app-vehicle-catalog-strip',
  imports: [NgIcon, ZardSkeletonComponent],
  viewProviders: [
    provideIcons({ lucideArrowRight, lucideCarFront, lucideCheck, lucidePlus }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
  template: `
    <div
      class="-mr-4 overflow-x-auto overscroll-x-contain pr-4 pl-[max(0px,calc((100%-48rem)/2))] [scroll-padding-left:max(0px,calc((100%-48rem)/2))] [scrollbar-width:none] sm:-mr-6 sm:pr-6 [&::-webkit-scrollbar]:hidden"
    >
      <div class="flex w-max snap-x gap-3" role="list">
        @for (vehicle of vehicles(); track vehicle.id) {
          <article
            class="relative w-56 shrink-0 snap-start"
            role="listitem"
            [attr.data-configuration-id]="vehicle.id"
          >
            <button
              type="button"
              class="block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              [attr.aria-label]="detailsLabel(vehicle)"
              (click)="vehicleSelected.emit(vehicle)"
            >
              <span
                class="grid aspect-[4/3] w-full place-items-center rounded-2xl bg-muted text-3xl text-muted-foreground"
                aria-label="Vehicle image not available"
              >
                <ng-icon name="lucideCarFront" aria-hidden="true" />
              </span>
              <span class="mt-2 block px-1">
                <span class="block truncate text-xs text-muted-foreground"
                  >{{ vehicle.brand }} · {{ vehicle.modelYear }}
                  @if (identity(vehicle); as label) {
                    · {{ label }}
                  }
                </span>
                <span class="block truncate font-medium"
                  >{{ vehicle.model }} {{ vehicle.name }}</span
                >
                @if (summariesLoading() && !summaries()) {
                  <z-skeleton class="mt-1.5 h-3 w-32" />
                  <z-skeleton class="mt-1.5 h-4 w-24" />
                } @else {
                  <span
                    class="mt-1 block truncate text-xs text-muted-foreground tabular-nums"
                  >
                    <span
                      [class.text-warning]="
                        fact(vehicle, 'power_max').status === 'conflicting'
                      "
                      >{{ fact(vehicle, 'power_max').text }}</span
                    >
                    ·
                    <span
                      [class.text-warning]="
                        fact(vehicle, 'torque_max').status === 'conflicting'
                      "
                      >{{ fact(vehicle, 'torque_max').text }}</span
                    >
                  </span>
                  <span
                    class="block truncate font-medium tabular-nums"
                    [class.text-muted-foreground]="
                      fact(vehicle, 'reference_price').status !== 'known'
                    "
                    [class.text-warning]="
                      fact(vehicle, 'reference_price').status === 'conflicting'
                    "
                    >{{ fact(vehicle, 'reference_price').text }}</span
                  >
                }
              </span>
            </button>
            <button
              type="button"
              class="absolute top-2 right-2 inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium shadow-sm backdrop-blur"
              [class.bg-background/90]="!isShortlisted(vehicle)"
              [class.hover:bg-background]="!isShortlisted(vehicle)"
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
              {{ isShortlisted(vehicle) ? 'Added' : 'Compare' }}
            </button>
          </article>
        }
        @if (hidden()) {
          <button
            type="button"
            class="grid aspect-[4/3] w-40 shrink-0 snap-start place-items-center self-start rounded-2xl border border-dashed border-border text-center hover:bg-muted/50"
            (click)="moreRequested.emit()"
          >
            <span>
              <span class="block text-lg font-semibold">+{{ hidden() }}</span>
              <span class="block text-xs text-muted-foreground">more</span>
            </span>
          </button>
        } @else if (nextPageSize()) {
          <button
            type="button"
            class="grid aspect-[4/3] w-40 shrink-0 snap-start place-items-center self-start rounded-2xl border border-dashed border-border px-3 text-center hover:bg-muted/50"
            (click)="nextPageRequested.emit()"
          >
            <span>
              <ng-icon name="lucideArrowRight" aria-hidden="true" />
              <span class="block text-xs font-medium"
                >Load next {{ nextPageSize() }}</span
              >
              <span class="block text-xs text-muted-foreground"
                >from the catalog</span
              >
            </span>
          </button>
        }
      </div>
    </div>
  `,
})
export class VehicleCatalogStrip extends VehicleCatalogItems {
  /** Configurations of the loaded page still hidden behind "show more". */
  readonly hidden = input(0);
  /** Size of the next catalog page to offer; zero hides the offer. */
  readonly nextPageSize = input(0);
  readonly moreRequested = output<void>();
  readonly nextPageRequested = output<void>();
}
