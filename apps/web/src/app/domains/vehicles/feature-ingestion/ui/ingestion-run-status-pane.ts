import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideCircleAlert,
  lucideRefreshCw,
} from '@ng-icons/lucide';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardSpinnerComponent } from '@/ui/components/spinner';

import type { IngestionStatus } from '../../data/ingestion-contracts';
import { RUN_STEPS, runStage } from '../ingestion-presentation';

/** Progress of one run: the four steps, the current badge and what blocks it. */
@Component({
  selector: 'app-ingestion-run-status-pane',
  imports: [
    NgIcon,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardSpinnerComponent,
  ],
  viewProviders: [
    provideIcons({ lucideCheck, lucideCircleAlert, lucideRefreshCw }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-wrap items-center gap-2">
      <z-badge [zType]="stage().badge" data-role="run-status">{{
        stage().label
      }}</z-badge>
      @if (status() === 'PUBLISHED') {
        <z-badge zType="secondary" data-role="projection-status">
          Graph {{ projectionLabel() }}
        </z-badge>
      }
      @if (attempts() > 1 && !stage().terminal) {
        <span class="text-xs text-muted-foreground"
          >Attempt {{ attempts() }}</span
        >
      }
      <button
        z-button
        zType="ghost"
        zSize="sm"
        type="button"
        class="ml-auto"
        (click)="refreshRequested.emit()"
        aria-label="Refresh status"
      >
        <ng-icon name="lucideRefreshCw" aria-hidden="true" />
        Refresh
      </button>
    </div>
    <ol class="mt-3 grid grid-cols-4 gap-2" aria-label="Import progress">
      @for (step of steps; track step; let index = $index) {
        <li
          class="flex flex-col gap-1.5 text-xs"
          [attr.aria-current]="index === stage().step ? 'step' : null"
        >
          <span
            class="h-1.5 rounded-full"
            [class.bg-primary]="index <= stage().step"
            [class.bg-muted]="index > stage().step"
            [class.animate-pulse]="index === stage().step && !stage().terminal"
          ></span>
          <span
            class="flex items-center gap-1"
            [class.text-foreground]="index <= stage().step"
            [class.text-muted-foreground]="index > stage().step"
          >
            @if (
              index < stage().step ||
              (index === stage().step && stage().terminal)
            ) {
              <ng-icon name="lucideCheck" class="size-3" aria-hidden="true" />
            } @else if (index === stage().step) {
              <z-spinner class="size-3" zAriaLabel="In progress" />
            }
            {{ step }}
          </span>
        </li>
      }
    </ol>
    @if (status() === 'QUEUED' || status() === 'PROCESSING') {
      <p class="mt-3 text-sm text-muted-foreground" role="status">
        The source is being captured and read. PDFs are transcribed page by
        page, then each configuration is extracted and checked against the text.
        This can take a few minutes; progress is saved and this view refreshes
        itself.
      </p>
    }
    @if (error()) {
      <p
        class="mt-3 flex items-start gap-2 text-sm text-destructive"
        role="alert"
      >
        <ng-icon
          name="lucideCircleAlert"
          class="mt-0.5 shrink-0"
          aria-hidden="true"
        />
        {{ error() }}
      </p>
    }
    @if (projectionError()) {
      <p class="mt-3 text-sm text-muted-foreground" role="status">
        {{ projectionError() }}
      </p>
    }
  `,
})
export class IngestionRunStatusPane {
  readonly status = input.required<IngestionStatus>();
  readonly projectionStatus = input('NOT_REQUESTED');
  readonly projectionError = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly attempts = input(0);
  readonly refreshRequested = output<void>();

  protected readonly steps = RUN_STEPS;
  protected readonly stage = computed(() => runStage(this.status()));
  protected readonly projectionLabel = computed(
    () =>
      (
        ({
          PENDING: 'update pending',
          CURRENT: 'up to date',
          UNCHANGED: 'unchanged',
        }) as Record<string, string>
      )[this.projectionStatus()] ?? this.projectionStatus().toLowerCase(),
  );
}
