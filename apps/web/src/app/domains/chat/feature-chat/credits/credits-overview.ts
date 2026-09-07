import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CreditsDetailStore } from '../chat-page/credits-detail-store';
import { CreditsUsageCard } from '../ui/credits-usage-card';

/**
 * The AI credits summary wherever the chat itself is not on screen: the shell
 * composes it into the account menu. It is the smart half of
 * `CreditsUsageCard` — the store is read here, the card only renders.
 *
 * Nothing is shown while credits are disabled or the wallet could not be
 * read, which is the same rule the chat page follows.
 */
@Component({
  selector: 'app-credits-overview',
  imports: [CreditsUsageCard],
  template: `
    @if (credits.enabled()) {
      <div class="border-b border-border px-3 py-2">
        <app-credits-usage-card
          [balance]="credits.balance()"
          [granted]="credits.granted()"
          [spent]="credits.spent()"
          [exhausted]="credits.exhausted()"
        />
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
})
export class CreditsOverview {
  protected readonly credits = inject(CreditsDetailStore);
}
