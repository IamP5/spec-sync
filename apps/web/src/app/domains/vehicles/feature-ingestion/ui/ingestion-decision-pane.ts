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
  lucideFileText,
  lucideGitFork,
} from '@ng-icons/lucide';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';

import type { ClaimRow } from '../ingestion-presentation';
import {
  decisionKindLabel,
  decisionStatusLabel,
} from '../ingestion-presentation';
import type { DecisionStatus, ReviewDecision } from '../review-decisions';

/**
 * One decision of the guided review: the attribute, the accepted catalog
 * value beside the proposal, and every candidate with the evidence lines the
 * source printed it on. Choices are owned by the parent and reported as
 * intentions.
 */
@Component({
  selector: 'app-ingestion-decision-pane',
  imports: [NgIcon, ZardBadgeComponent, ZardButtonComponent],
  viewProviders: [
    provideIcons({
      lucideCheck,
      lucideChevronDown,
      lucideCircleAlert,
      lucideFileText,
      lucideGitFork,
    }),
  ],
  templateUrl: './ingestion-decision-pane.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class IngestionDecisionPane {
  readonly decision = input.required<ReviewDecision>();
  readonly configuration = input.required<string>();
  readonly status = input.required<DecisionStatus>();
  /** Claim index the reviewer selected for this attribute, when any. */
  readonly selectedIndex = input<number>();
  /** Whether the reviewer may still change this decision. */
  readonly reviewing = input(false);
  readonly candidateChosen = output<number>();
  readonly choiceCleared = output<void>();
  readonly decisionDeferred = output<void>();
  readonly evidenceRequested = output<void>();

  protected readonly expanded = signal<ReadonlySet<number>>(new Set());
  protected readonly kindLabel = computed(() =>
    decisionKindLabel(this.decision().kind),
  );
  protected readonly statusLabel = computed(() =>
    decisionStatusLabel(this.decision().kind, this.status()),
  );
  /** The candidate the reviewer holds: their choice, else what was published. */
  protected readonly chosen = computed<ClaimRow | undefined>(() => {
    const decision = this.decision();
    const index = this.selectedIndex();
    return (
      decision.published ??
      decision.candidates.find((row) => row.index === index)
    );
  });
  protected readonly open = computed(
    () =>
      this.decision().kind !== 'published' && this.decision().kind !== 'same',
  );
  protected readonly deferLabel = computed(() =>
    this.decision().kind === 'unverified'
      ? this.status() === 'deferred'
        ? this.acknowledged
        : this.acknowledge
      : this.status() === 'deferred'
        ? this.deferred
        : this.defer,
  );
  protected readonly acknowledge = $localize`Acknowledge and keep pending`;
  protected readonly acknowledged = $localize`Acknowledged`;
  protected readonly defer = $localize`Decide later`;
  protected readonly deferred = $localize`Decided later`;
  protected readonly notInCatalog = $localize`Not in catalog`;

  protected chooseLabel(row: ClaimRow): string {
    const value = row.proposed || row.raw;
    return $localize`Select ${value}:value:`;
  }

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
}
