import { NgOptimizedImage, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCarFront } from '@ng-icons/lucide';

import type { VehicleImageMetadata } from '../data/vehicle-contracts';

@Component({
  selector: 'app-vehicle-image',
  imports: [NgOptimizedImage, NgTemplateOutlet, NgIcon],
  viewProviders: [provideIcons({ lucideCarFront })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative block overflow-hidden bg-muted text-muted-foreground',
  },
  template: `
    @if (image(); as photo) {
      @if (!failed()) {
        <img
          [ngSrc]="photo.url"
          [alt]="photo.altText"
          fill
          class="object-cover"
          [sizes]="sizes()"
          (error)="failed.set(true)"
        />
        @if (photo.matchScope === 'ILLUSTRATIVE') {
          <span
            [class.sr-only]="compact()"
            class="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-foreground"
          >
            Illustrative image
          </span>
        }
      } @else {
        <ng-container [ngTemplateOutlet]="fallback" />
      }
    } @else {
      <ng-container [ngTemplateOutlet]="fallback" />
    }
    <ng-template #fallback>
      <span
        class="absolute inset-0 grid place-items-center"
        role="img"
        aria-label="Vehicle image not available"
      >
        <ng-icon name="lucideCarFront" aria-hidden="true" />
      </span>
    </ng-template>
  `,
})
export class VehicleImage {
  readonly image = input<VehicleImageMetadata | null>();
  readonly compact = input(false);
  readonly sizes = input('100vw');
  private readonly url = computed(() => this.image()?.url);
  protected readonly failed = linkedSignal({
    source: this.url,
    computation: () => false,
  });
}
