import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideKeyRound, lucideSend, lucideX } from '@ng-icons/lucide';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardInputComponent } from '@/ui/components/input';
import { ZardSkeletonComponent } from '@/ui/components/skeleton';
import { ZardTabsImports } from '@/ui/components/tabs';
import { ZardTextareaComponent } from '@/ui/components/textarea';

import type {
  IngestionConfigurationDraft,
  IngestionReview,
  IngestionRunSummary,
} from '../data/ingestion-contracts';
import { IngestionDetailStore } from './ingestion-detail-store';
import {
  claimCounts,
  claimGroups,
  defaultSelection,
  runIsActive,
  runStage,
  runTitle,
  summarizeRun,
  toggleSelection,
} from './ingestion-presentation';
import { IngestionClaimsPane } from './ui/ingestion-claims-pane';
import { IngestionRunStatusPane } from './ui/ingestion-run-status-pane';
import { IngestionSourcePane } from './ui/ingestion-source-pane';

/** Polling interval while the API processes the run or the graph update is pending. */
const POLL_MS = 8000;

interface ConfigurationReviewState {
  identityConfirmed: boolean;
  selected: boolean[];
}

/**
 * One import run from queue to publication: progress, the captured source,
 * one tab per configuration with its evidence table, and the review
 * decision. The same component serves the ingestion page and the chat card;
 * the run id identifies persisted API state, so it can be reopened later.
 */
@Component({
  selector: 'app-vehicle-ingestion-run-detail',
  imports: [
    FormField,
    NgIcon,
    IngestionClaimsPane,
    IngestionRunStatusPane,
    IngestionSourcePane,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardInputComponent,
    ZardSkeletonComponent,
    ZardTextareaComponent,
    ...ZardTabsImports,
  ],
  providers: [IngestionDetailStore],
  viewProviders: [provideIcons({ lucideKeyRound, lucideSend, lucideX })],
  templateUrl: './vehicle-ingestion-run-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
})
export class VehicleIngestionRunDetail {
  readonly runId = input('');
  readonly researchId = input('');
  /** Compact chrome for the chat transcript. */
  readonly compact = input(false, { transform: booleanAttribute });
  /** Credential-free summary, emitted whenever the persisted run changes. */
  readonly runChanged = output<IngestionRunSummary>();

  protected readonly store = inject(IngestionDetailStore);
  protected readonly run = this.store.runValue;
  protected readonly loading = this.store.runIsLoading;
  protected readonly hasKey = this.store.hasKey;
  protected readonly keyModel = signal({ key: '' });
  protected readonly keyForm = form(this.keyModel, (p) => required(p.key));
  protected readonly title = computed(() => {
    const run = this.run();
    return run ? runTitle(run.request) : '';
  });
  protected readonly stage = computed(() => {
    const run = this.run();
    return run ? runStage(run.status) : undefined;
  });
  protected readonly reviewing = computed(
    () => this.run()?.status === 'REVIEW',
  );
  protected readonly configurations = computed<IngestionConfigurationDraft[]>(
    () => this.run()?.draft?.configurations ?? [],
  );
  /** Selection and identity confirmation per configuration; resets when the reviewed draft or catalog changes. */
  protected readonly reviewState = linkedSignal({
    source: () => `${this.run()?.draftHash}:${this.run()?.baseRevision}`,
    computation: (): ConfigurationReviewState[] =>
      this.configurations().map((configuration) => ({
        identityConfirmed: false,
        selected: configuration.claims.map(() => false),
      })),
  });
  protected readonly reasonModel = linkedSignal({
    source: () => this.run()?.draftHash ?? '',
    computation: () => ({ reason: '' }),
  });
  protected readonly reasonForm = form(this.reasonModel, (p) =>
    required(p.reason),
  );
  protected readonly selectedTotal = computed(() =>
    this.reviewState().reduce(
      (total, state) => total + state.selected.filter(Boolean).length,
      0,
    ),
  );
  /** Configurations with a selection but no identity confirmation block publication. */
  protected readonly unconfirmed = computed(() =>
    this.reviewState()
      .map((state, index) =>
        state.selected.some(Boolean) && !state.identityConfirmed
          ? this.configurations()[index]?.name
          : undefined,
      )
      .filter((name): name is string => !!name),
  );
  protected readonly canPublish = computed(
    () =>
      this.reviewing() &&
      this.selectedTotal() > 0 &&
      this.unconfirmed().length === 0 &&
      this.reasonModel().reason.trim().length > 0 &&
      !this.busy(),
  );
  protected readonly busy = computed(
    () => this.store.publishIsPending() || this.store.rejectIsPending(),
  );
  protected readonly error = computed(
    () =>
      this.store.publishError()?.message ??
      this.store.rejectError()?.message ??
      (this.store.runError()
        ? 'Não foi possível carregar a revisão. Entre na sua conta e atualize.'
        : ''),
  );

  constructor() {
    effect(() => {
      const id = this.runId();
      const researchId = this.researchId();
      const scope = this.store.sessionScope?.();
      untracked(() =>
        researchId
          ? this.store.load(id, scope ? researchId : '')
          : this.store.load(id),
      );
    });
    effect(() => {
      const run = this.run();
      if (run) this.runChanged.emit(summarizeRun(run));
    });
    const timer = setInterval(() => {
      if (runIsActive(this.run())) this.store.reload();
    }, POLL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected tabLabel(configuration: IngestionConfigurationDraft): string {
    const counts = claimCounts(
      claimGroups(configuration, this.run()?.currentValues[configuration.name]),
    );
    return `${configuration.name} (${counts.total})`;
  }

  protected selectionOf(index: number): boolean[] {
    return this.reviewState()[index]?.selected ?? [];
  }

  protected identityOf(index: number): boolean {
    return this.reviewState()[index]?.identityConfirmed ?? false;
  }

  protected toggleClaim(configuration: number, claim: number): void {
    const draft = this.configurations()[configuration];
    if (!draft) return;
    const groups = claimGroups(draft, this.run()?.currentValues[draft.name]);
    this.updateState(configuration, (state) => ({
      ...state,
      selected: toggleSelection(state.selected, groups, claim),
    }));
  }

  protected setIdentity(configuration: number, confirmed: boolean): void {
    this.updateState(configuration, (state) => ({
      ...state,
      identityConfirmed: confirmed,
    }));
  }

  protected selectSuggested(configuration: number): void {
    const draft = this.configurations()[configuration];
    if (!draft) return;
    const groups = claimGroups(draft, this.run()?.currentValues[draft.name]);
    this.updateState(configuration, (state) => ({
      ...state,
      selected: defaultSelection(groups, draft.claims.length),
    }));
  }

  protected clearSelection(configuration: number): void {
    this.updateState(configuration, (state) => ({
      ...state,
      selected: state.selected.map(() => false),
    }));
  }

  protected connect(event: Event): void {
    event.preventDefault();
    if (this.keyForm().invalid()) return;
    this.store.setKey(this.keyModel().key);
    this.keyModel.set({ key: '' });
  }

  protected async publish(event: Event): Promise<void> {
    event.preventDefault();
    const run = this.run();
    if (!run?.draftHash || !this.canPublish()) return;
    const review: IngestionReview = {
      draftHash: run.draftHash,
      baseRevision: run.baseRevision,
      reason: this.reasonModel().reason.trim(),
      configurations: this.reviewState()
        .map((state, index) => ({
          configuration: index,
          identityConfirmed: state.identityConfirmed,
          selectedClaims: state.selected.flatMap((selected, claim) =>
            selected ? [claim] : [],
          ),
        }))
        .filter((decision) => decision.selectedClaims.length > 0),
    };
    await this.store.publish(review);
  }

  protected reject(): void {
    void this.store.reject();
  }

  private updateState(
    index: number,
    update: (state: ConfigurationReviewState) => ConfigurationReviewState,
  ): void {
    this.reviewState.update((states) =>
      states.map((state, i) => (i === index ? update(state) : state)),
    );
  }
}
