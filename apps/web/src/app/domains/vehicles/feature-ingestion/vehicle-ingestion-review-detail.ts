import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  LOCALE_ID,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCheck,
  lucideSend,
} from '@ng-icons/lucide';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardSkeletonComponent } from '@/ui/components/skeleton';
import { ZardTextareaComponent } from '@/ui/components/textarea';

import type {
  IngestionConfigurationDraft,
  IngestionRunSummary,
} from '../data/ingestion-contracts';
import type { ResearchEvidenceFocus } from '../data/research-presentation';
import { IngestionDetailStore } from './ingestion-detail-store';
import { decisionStatusLabel, summarizeRun } from './ingestion-presentation';
import {
  canPublish,
  carryOverDecisions,
  chooseCandidate,
  clearChoice,
  type ConfigurationDecisions,
  decisionCounts,
  type DecisionStatus,
  decisionStatus,
  deferDecision,
  initialDecisions,
  nextPending,
  publishedClaims,
  type ReviewDecision,
  reviewDecisions,
  type ReviewModel,
  reviewPayload,
  selectPreApproved,
  sumCounts,
} from './review-decisions';
import { IngestionDecisionPane } from './ui/ingestion-decision-pane';

type DecisionFilter = 'all' | 'pending' | 'selected' | 'published';

interface PublicationBatch {
  readonly index: number;
  readonly name: string;
  readonly state: ConfigurationDecisions;
  readonly items: { label: string; proposed: string }[];
}

/**
 * Guided review of one research draft, one decision at a time. Evidenced
 * candidates without competition are pre-approved, so the reviewer only
 * decides conflicts and acknowledges unverified evidence before publishing.
 * A publication may cover part of the draft; what it published stays visible
 * and the rest remains available for a later review of the same research.
 *
 * Choices live with this instance for the draft revision they were made on:
 * a new revision keeps the ones still valid and drops the rest.
 */
@Component({
  selector: 'app-vehicle-ingestion-review-detail',
  imports: [
    FormField,
    NgIcon,
    IngestionDecisionPane,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardSkeletonComponent,
    ZardTextareaComponent,
  ],
  providers: [IngestionDetailStore],
  viewProviders: [
    provideIcons({
      lucideArrowLeft,
      lucideArrowRight,
      lucideCheck,
      lucideSend,
    }),
  ],
  templateUrl: './vehicle-ingestion-review-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
})
export class VehicleIngestionReviewDetail {
  readonly researchId = input.required<string>();
  /** Whether the decisions are shown; the summary strip is always there. */
  readonly open = input(false);
  readonly openChange = output<boolean>();
  readonly evidenceRequested = output<ResearchEvidenceFocus>();
  /** Credential-free summary, emitted whenever the persisted run changes. */
  readonly runChanged = output<IngestionRunSummary>();

  private readonly locale = inject(LOCALE_ID);
  protected readonly store = inject(IngestionDetailStore);
  protected readonly run = this.store.runValue;
  protected readonly loading = this.store.runIsLoading;
  private readonly decisionRegion =
    viewChild<ElementRef<HTMLElement>>('decisionRegion');

  protected readonly reviewable = computed(() => {
    const status = this.run()?.status;
    return status === 'REVIEW' || status === 'PUBLISHED';
  });
  protected readonly configurations = computed<IngestionConfigurationDraft[]>(
    () => this.run()?.draft?.configurations ?? [],
  );
  protected readonly decisions = computed<ReviewDecision[][]>(() => {
    const run = this.run();
    const published = publishedClaims(run?.decisions ?? []);
    return this.configurations().map((configuration, index) =>
      reviewDecisions(
        configuration,
        run?.currentValues[configuration.name],
        published.get(index) ?? new Set(),
        this.locale,
      ),
    );
  });
  /** The reviewer's choices, keyed to the draft revision they belong to. */
  protected readonly model = linkedSignal<string, ReviewModel>({
    source: () => {
      const run = this.run();
      return `${run?.draftHash ?? ''}|${run?.baseRevision ?? 0}|${run?.decisions.length ?? 0}`;
    },
    computation: (source, previous) => {
      const hash = source.split('|')[0];
      const keep = !!hash && previous?.source.split('|')[0] === hash;
      const decisions = untracked(() => this.decisions());
      return {
        reason: keep ? previous.value.reason : '',
        configurations: decisions.map((items, index) =>
          keep
            ? carryOverDecisions(previous.value.configurations[index], items)
            : initialDecisions(items),
        ),
      };
    },
  });
  protected readonly fields = form(this.model);

  protected readonly activeIndex = signal(0);
  protected readonly filter = signal<DecisionFilter>('all');
  protected readonly focusedCodes = signal<Record<number, string>>({});
  protected readonly publicationOpen = signal(false);
  protected readonly receipt = signal<{
    claims: number;
    configurations: number;
  } | null>(null);

  protected readonly configuration = computed<
    IngestionConfigurationDraft | undefined
  >(() => this.configurations()[this.activeIndex()]);
  protected readonly activeDecisions = computed(
    () => this.decisions()[this.activeIndex()] ?? [],
  );
  protected readonly activeState = computed(
    () =>
      this.model().configurations[this.activeIndex()] ??
      initialDecisions(this.activeDecisions()),
  );
  protected readonly counts = computed(() =>
    this.decisions().map((items, index) =>
      decisionCounts(
        items,
        this.model().configurations[index] ?? initialDecisions(items),
      ),
    ),
  );
  protected readonly totals = computed(() => sumCounts(this.counts()));
  protected readonly visible = computed(() =>
    this.activeDecisions().filter((decision) => {
      const status = this.statusOf(decision);
      switch (this.filter()) {
        case 'all':
          return true;
        case 'pending':
          return status === 'pending';
        case 'selected':
          return status === 'selected';
        case 'published':
          return status === 'published';
      }
    }),
  );
  protected readonly focused = computed(() => {
    const code = this.focusedCodes()[this.activeIndex()];
    return (
      this.visible().find((decision) => decision.attributeCode === code) ??
      this.visible()[0]
    );
  });
  protected readonly position = computed(
    () =>
      this.visible().findIndex(
        (decision) => decision.attributeCode === this.focused()?.attributeCode,
      ) + 1,
  );
  protected readonly filters: readonly { id: DecisionFilter; label: string }[] =
    [
      { id: 'all', label: $localize`:decision queue filter|:All` },
      { id: 'pending', label: $localize`:decision queue filter|:Pending` },
      { id: 'selected', label: $localize`:decision queue filter|:Selected` },
      {
        id: 'published',
        label: $localize`:decision queue filter|:Published`,
      },
    ];
  /** Selected attributes the review pre-approved and the reviewer left in place. */
  protected readonly preApproved = computed(() =>
    this.decisions().reduce(
      (total, items, index) =>
        total +
        items.filter(
          (decision) =>
            decision.kind === 'auto' &&
            decision.attributeCode in
              (this.model().configurations[index]?.selected ?? {}),
        ).length,
      0,
    ),
  );
  protected readonly batches = computed<PublicationBatch[]>(() =>
    this.configurations()
      .map((configuration, index) => {
        const state =
          this.model().configurations[index] ??
          initialDecisions(this.decisions()[index] ?? []);
        return {
          index,
          name: configuration.name,
          state,
          items: (this.decisions()[index] ?? []).flatMap((decision) => {
            const chosen = decision.candidates.find(
              (row) => row.index === state.selected[decision.attributeCode],
            );
            return chosen
              ? [
                  {
                    label: decision.label,
                    proposed: chosen.proposed || chosen.raw,
                  },
                ]
              : [];
          }),
        };
      })
      .filter((batch) => batch.items.length > 0),
  );
  protected readonly unconfirmed = computed(() =>
    this.batches()
      .filter((batch) => !batch.state.identityConfirmed)
      .map((batch) => batch.name),
  );
  protected readonly busy = computed(() => this.store.publishIsPending());
  protected readonly canPublish = computed(
    () => this.reviewable() && canPublish(this.model()) && !this.busy(),
  );
  protected readonly error = computed(
    () =>
      this.store.publishError()?.message ??
      (this.store.runError()
        ? $localize`The review could not be loaded. Sign in and refresh.`
        : ''),
  );
  protected readonly publishingLabel = $localize`Publishing…`;
  protected readonly readyLabel = $localize`Ready to publish`;
  protected readonly needsIdentityLabel = $localize`Confirm the identity`;
  protected readonly reviewLabel = $localize`Review decisions`;
  protected readonly nextPendingLabel = $localize`Next pending decision`;
  protected readonly nothingPendingLabel = $localize`Nothing pending · review the publication`;
  protected readonly backLabel = $localize`Back to the research`;

  constructor() {
    effect(() => {
      const researchId = this.researchId();
      const scope = this.store.sessionScope?.();
      untracked(() => this.store.load('', scope ? researchId : ''));
    });
    effect(() => {
      const run = this.run();
      if (run) this.runChanged.emit(summarizeRun(run));
    });
  }

  protected statusOf(decision: ReviewDecision): DecisionStatus {
    return decisionStatus(decision, this.activeState());
  }
  protected statusLabel(decision: ReviewDecision): string {
    return decisionStatusLabel(decision.kind, this.statusOf(decision));
  }
  protected countLabel(filter: DecisionFilter): number {
    const counts = this.counts()[this.activeIndex()];
    if (!counts) return 0;
    return filter === 'all' ? counts.total : counts[filter];
  }
  protected batchLabel(batch: PublicationBatch): string {
    const count = batch.items.length;
    return $localize`${count}:count: selected`;
  }

  protected toggleOpen(): void {
    this.openChange.emit(!this.open());
  }
  protected selectConfiguration(index: number): void {
    this.activeIndex.set(index);
    this.filter.set('all');
  }
  protected focus(attributeCode: string): void {
    this.focusedCodes.update((codes) => ({
      ...codes,
      [this.activeIndex()]: attributeCode,
    }));
  }
  protected choose(decision: ReviewDecision, index: number): void {
    this.updateActive((state) => chooseCandidate(state, decision, index));
  }
  protected clear(decision: ReviewDecision): void {
    this.updateActive((state) => clearChoice(state, decision.attributeCode));
  }
  protected defer(decision: ReviewDecision): void {
    this.updateActive((state) => deferDecision(state, decision.attributeCode));
  }
  protected selectPreApprovedHere(): void {
    const decisions = this.activeDecisions();
    this.updateActive((state) => selectPreApproved(state, decisions));
  }
  protected clearHere(): void {
    this.updateActive((state) => ({ ...state, selected: {} }));
  }
  protected navigate(delta: number): void {
    const decisions = this.visible();
    if (!decisions.length) return;
    const next =
      decisions[
        (this.position() - 1 + delta + decisions.length) % decisions.length
      ];
    this.focus(next.attributeCode);
    this.focusRegion();
  }
  /** The next open decision here, then in the next configuration; the summary once none is left. */
  protected goToNextPending(): void {
    const total = this.configurations().length;
    for (let step = 0; step < total; step += 1) {
      const index = (this.activeIndex() + step) % total;
      const state =
        this.model().configurations[index] ??
        initialDecisions(this.decisions()[index] ?? []);
      const from = step === 0 ? this.focused()?.attributeCode : undefined;
      const next = nextPending(this.decisions()[index] ?? [], state, from);
      if (next) {
        if (index !== this.activeIndex()) this.selectConfiguration(index);
        this.filter.set('all');
        this.focus(next.attributeCode);
        this.focusRegion();
        return;
      }
    }
    this.publicationOpen.set(true);
  }
  protected openPublication(open: boolean): void {
    this.publicationOpen.set(open);
    if (!open) this.focusRegion();
  }
  protected continueReviewing(): void {
    this.receipt.set(null);
    this.publicationOpen.set(false);
    this.goToNextPending();
  }

  protected async publish(event: Event): Promise<void> {
    event.preventDefault();
    const run = this.run();
    if (!run?.draftHash || !this.canPublish()) return;
    const review = reviewPayload(
      { draftHash: run.draftHash, baseRevision: run.baseRevision },
      this.model(),
    );
    const result = await this.store.publish(review);
    if (result.status === 'success')
      this.receipt.set({
        claims: review.configurations.reduce(
          (total, decision) => total + decision.selectedClaims.length,
          0,
        ),
        configurations: review.configurations.length,
      });
  }

  private updateActive(
    update: (state: ConfigurationDecisions) => ConfigurationDecisions,
  ): void {
    const index = this.activeIndex();
    this.model.update((model) => ({
      ...model,
      configurations: model.configurations.map((state, i) =>
        i === index ? update(state) : state,
      ),
    }));
  }

  /** Keyboard users land on the decision they navigated to. */
  private focusRegion(): void {
    setTimeout(() => this.decisionRegion()?.nativeElement.focus());
  }
}
