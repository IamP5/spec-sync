import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';

import { ZardProgressComponent } from '@/ui/components/progress';

import { formatCredits } from '../../data/credits';

/**
 * The same wallet summary as the composer pill, as one compact row: what is
 * left of the promotional grant and how much of it is used. The account menu
 * shows it, so the balance is visible without opening a conversation.
 *
 * Dumb component: it receives the amounts and renders them.
 */
@Component({
  selector: 'app-credits-usage-card',
  imports: [ZardProgressComponent],
  template: `
    <div class="flex flex-col gap-1.5" data-role="credits-usage">
      <div class="flex items-baseline justify-between gap-2">
        <span class="text-xs text-muted-foreground" i18n>AI Credits</span>
        <span
          class="text-xs font-medium tabular-nums"
          data-role="credits-usage-balance"
          [class.text-destructive]="exhausted()"
          >{{ balanceLabel() }}</span
        >
      </div>
      <z-progress
        class="h-1"
        [value]="usedPercent()"
        [attr.aria-label]="description()"
      />
      <span class="text-[11px] text-muted-foreground">{{ remaining() }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class CreditsUsageCard {
  readonly balance = input(0);
  readonly granted = input(0);
  readonly spent = input(0);
  readonly exhausted = input(false);

  private readonly locale = inject(LOCALE_ID);
  protected readonly balanceLabel = computed(() =>
    formatCredits(this.balance(), this.locale),
  );
  protected readonly grantedLabel = computed(() =>
    formatCredits(this.granted(), this.locale),
  );
  protected readonly usedPercent = computed(() => {
    const granted = this.granted();
    if (granted <= 0) {
      return this.exhausted() ? 100 : 0;
    }
    return Math.round(Math.min(Math.max(this.spent() / granted, 0), 1) * 100);
  });
  protected readonly remaining = computed(() => {
    const granted = this.grantedLabel();
    return this.exhausted()
      ? $localize`Used up`
      : $localize`of ${granted}:granted: left`;
  });
  protected readonly description = computed(() => {
    const balance = this.balanceLabel();
    const granted = this.grantedLabel();
    const used = this.usedPercent();
    return $localize`AI Credits: ${balance}:balance: of ${granted}:granted: left, ${used}:used:% used`;
  });
}
