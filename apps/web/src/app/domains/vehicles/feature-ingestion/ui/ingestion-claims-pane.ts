import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideChevronDown,
  lucideCircleAlert,
  lucideGitFork,
  lucideTriangleAlert,
} from '@ng-icons/lucide';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardTableImports } from '@/ui/components/table';

import type {
  IngestionConfigurationDraft,
  IngestionCurrentCell,
} from '../../data/ingestion-contracts';
import {
  CLAIM_FILTERS,
  claimCounts,
  type ClaimFilter,
  type ClaimGroup,
  claimGroups,
  filterGroups,
} from '../ingestion-presentation';

/**
 * Review table of one configuration: identity evidence, counts, a filter bar
 * and one row per proposed claim with the current catalog value beside the
 * proposal. Selection and identity confirmation are owned by the parent.
 */
@Component({
  selector: 'app-ingestion-claims-pane',
  imports: [
    NgIcon,
    ZardBadgeComponent,
    ZardButtonComponent,
    ...ZardTableImports,
  ],
  viewProviders: [
    provideIcons({
      lucideCheck,
      lucideChevronDown,
      lucideCircleAlert,
      lucideGitFork,
      lucideTriangleAlert,
    }),
  ],
  templateUrl: './ingestion-claims-pane.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class IngestionClaimsPane {
  readonly configuration = input.required<IngestionConfigurationDraft>();
  readonly current = input<Record<string, IngestionCurrentCell>>();
  readonly selected = input<boolean[]>([]);
  readonly identityConfirmed = input(false);
  /** Whether the reviewer may change selections (run in REVIEW). */
  readonly reviewing = input(false);
  readonly claimToggled = output<number>();
  readonly identityChanged = output<boolean>();
  readonly suggestedRequested = output<void>();
  readonly clearRequested = output<void>();

  protected readonly filters = CLAIM_FILTERS;
  protected readonly filter = signal<ClaimFilter>('all');
  protected readonly expanded = signal<ReadonlySet<number>>(new Set());
  protected readonly groups = computed<ClaimGroup[]>(() =>
    claimGroups(this.configuration(), this.current()),
  );
  protected readonly counts = computed(() => claimCounts(this.groups()));
  protected readonly visibleGroups = computed(() =>
    filterGroups(this.groups(), this.filter()),
  );
  protected readonly selectedCount = computed(
    () => this.selected().filter(Boolean).length,
  );

  protected isExpanded(index: number): boolean {
    return this.expanded().has(index);
  }
  protected toggleExpanded(index: number): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }
  protected onIdentityChange(event: Event): void {
    this.identityChanged.emit((event.target as HTMLInputElement).checked);
  }
}
