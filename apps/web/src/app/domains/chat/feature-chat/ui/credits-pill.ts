import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  input,
  LOCALE_ID,
  signal,
} from '@angular/core';

import {
  ZardPopoverComponent,
  ZardPopoverDirective,
} from '@/ui/components/popover';
import { ZardProgressComponent } from '@/ui/components/progress';

import { type CreditsRunCharge, formatCredits } from '../../data/credits';

/** How many of the recent runs the panel lists. */
const RECENT_RUNS_SHOWN = 5;

/**
 * The AI credits of the signed-in user as a composer pill, in the style of
 * the run options next to it: the credits left, a thin bar for the share of
 * the promotional grant already spent, and a panel with where they went: the
 * last runs and what each of them cost.
 *
 * Dumb component: the chat page reads the wallet and hands it over field by
 * field. Formatting an amount is presentation and stays here (through the
 * shared `formatCredits`), as does the open/closed state of the panel.
 */
@Component({
  selector: 'app-credits-pill',
  imports: [ZardPopoverComponent, ZardPopoverDirective, ZardProgressComponent],
  template: `
    <button
      type="button"
      data-role="credits"
      class="chat-credits inline-flex min-h-8 max-w-40 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-foreground/80 transition-[background-color,color,transform] duration-150 ease-out hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.97] motion-reduce:transition-none aria-expanded:bg-accent aria-expanded:text-foreground"
      zPopover
      [zContent]="panel"
      zPlacement="top"
      zAlign="start"
      zSideOffset="10"
      [attr.aria-label]="triggerDescription()"
      (zVisibleChange)="onVisible($event)"
    >
      <span
        class="tabular-nums"
        data-role="credits-balance"
        [class.text-destructive]="exhausted()"
        i18n
        >{{ balanceLabel() }} credits</span
      >
      <span
        class="block h-1 w-8 shrink-0 rounded-full bg-foreground/10"
        aria-hidden="true"
      >
        <span
          class="block h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
          [class]="exhausted() ? 'bg-destructive' : 'bg-primary'"
          [style.width.%]="usedPercent()"
        ></span>
      </span>
    </button>

    <ng-template #panel>
      <z-popover
        data-role="credits-panel"
        tabindex="-1"
        i18n-aria-label
        aria-label="AI Credits"
        class="w-80 max-w-[calc(100vw-2rem)] gap-3 rounded-2xl p-4"
      >
        <div class="flex flex-col gap-1">
          <h2 class="text-sm font-semibold" i18n>AI Credits</h2>
          <p class="text-sm text-foreground" data-role="credits-summary" i18n>
            {{ balanceLabel() }} of {{ grantedLabel() }}
          </p>
          <z-progress
            class="mt-1 h-1.5"
            [value]="usedPercent()"
            [attr.aria-label]="progressDescription()"
          />
          <p
            class="text-xs text-muted-foreground"
            data-role="credits-spent"
            i18n
          >
            Used {{ spentLabel() }}
          </p>
        </div>

        @if (runs().length) {
          <div class="flex flex-col gap-1">
            <h3 class="text-xs font-medium text-muted-foreground" i18n>
              Recent replies
            </h3>
            <ul class="flex flex-col" data-role="credits-runs">
              @for (run of runs(); track run.runId) {
                <li
                  class="flex items-center justify-between gap-2 py-1 text-xs"
                >
                  <span class="min-w-0 truncate">{{ run.modelId }}</span>
                  <span class="shrink-0 tabular-nums text-muted-foreground">{{
                    price(run.charge)
                  }}</span>
                </li>
              }
            </ul>
          </div>
        }
      </z-popover>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex min-w-0' },
})
export class CreditsPill {
  private readonly document = inject(DOCUMENT);

  /** Ledger balance in micro-credits; a negative one shows as nothing left. */
  readonly balance = input(0);
  /** The promotional grant the balance is measured against. */
  readonly granted = input(0);
  /** What has been spent so far; drives the bar. */
  readonly spent = input(0);
  readonly exhausted = input(false);
  readonly recentRuns = input<readonly CreditsRunCharge[]>([]);

  /** Mirrors the popover, so the trigger can report its state. */
  protected readonly open = signal(false);

  private readonly locale = inject(LOCALE_ID);
  protected readonly balanceLabel = computed(() =>
    formatCredits(this.balance(), this.locale),
  );
  protected readonly grantedLabel = computed(() =>
    formatCredits(this.granted(), this.locale),
  );
  protected readonly spentLabel = computed(() =>
    formatCredits(this.spent(), this.locale),
  );
  protected readonly runs = computed(() =>
    this.recentRuns().slice(0, RECENT_RUNS_SHOWN),
  );
  protected readonly usedPercent = computed(() => {
    const granted = this.granted();
    if (granted <= 0) {
      return this.exhausted() ? 100 : 0;
    }
    return Math.round(Math.min(Math.max(this.spent() / granted, 0), 1) * 100);
  });
  protected readonly triggerDescription = computed(() => {
    const balance = this.balanceLabel();
    const granted = this.grantedLabel();
    return $localize`AI Credits: ${balance}:balance: of ${granted}:granted: left`;
  });
  protected readonly progressDescription = computed(() => {
    const used = this.usedPercent();
    return $localize`${used}:used:% of your AI credits used`;
  });

  protected price(micro: number): string {
    return formatCredits(micro, this.locale);
  }

  protected onVisible(visible: boolean): void {
    this.open.set(visible);
    if (visible) {
      this.focusPanel();
    }
  }

  /** Move focus into the open panel so the keyboard reaches its content. */
  private focusPanel(): void {
    setTimeout(() => {
      this.document
        .querySelector<HTMLElement>('[data-role="credits-panel"]')
        ?.focus();
    });
  }
}
