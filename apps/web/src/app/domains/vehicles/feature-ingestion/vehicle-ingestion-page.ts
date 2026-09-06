import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { form, FormField, max, min, required } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ZardButtonComponent } from '@/ui/components/button';
import { ZardInputComponent } from '@/ui/components/input';
import { ZardTextareaComponent } from '@/ui/components/textarea';

import { type IngestionRequest } from '../data/ingestion-contracts';
import { IngestionDetailStore } from './ingestion-detail-store';

@Component({
  selector: 'app-vehicle-ingestion-page',
  imports: [
    FormField,
    RouterLink,
    JsonPipe,
    ZardButtonComponent,
    ZardInputComponent,
    ZardTextareaComponent,
  ],
  providers: [IngestionDetailStore],
  templateUrl: './vehicle-ingestion-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full overflow-y-auto' },
})
export class VehicleIngestionPage {
  readonly runId = input<string>();
  protected readonly store = inject(IngestionDetailStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly credentials = signal({ key: '' });
  protected readonly credentialForm = form(this.credentials);
  protected readonly inputModel = signal({
    sourceUrl: this.route.snapshot.queryParamMap.get('sourceUrl') ?? '',
    brand: this.route.snapshot.queryParamMap.get('brand') ?? '',
    model: this.route.snapshot.queryParamMap.get('model') ?? '',
    name: this.route.snapshot.queryParamMap.get('name') ?? '',
    modelYear: Number(
      this.route.snapshot.queryParamMap.get('modelYear') ?? 2026,
    ),
  });
  protected readonly sourceForm = form(this.inputModel, (p) => {
    required(p.sourceUrl);
    required(p.brand);
    required(p.model);
    required(p.name);
    min(p.modelYear, 1900);
    max(p.modelYear, 2200);
  });
  protected readonly reviewModel = linkedSignal({
    source: () =>
      `${this.store.runValue()?.draftHash}:${this.store.runValue()?.baseRevision}`,
    computation: () => ({
      identityConfirmed: false,
      reason: '',
      selected: (this.store.runValue()?.draft?.claims ?? []).map(() => false),
    }),
  });
  protected readonly reviewForm = form(this.reviewModel, (p) =>
    required(p.reason),
  );
  protected readonly selectedCount = computed(
    () => this.reviewModel().selected.filter(Boolean).length,
  );
  protected readonly busy = computed(
    () =>
      this.store.createIsPending() ||
      this.store.publishIsPending() ||
      this.store.rejectIsPending(),
  );
  protected readonly error = computed(
    () =>
      this.store.createError()?.message ??
      this.store.publishError()?.message ??
      this.store.rejectError()?.message ??
      (this.store.runError()
        ? 'Could not load this import. Check the curator key and refresh.'
        : ''),
  );
  private requestId = crypto.randomUUID();
  private requestValue = '';
  constructor() {
    effect(() => {
      const id = this.runId() ?? '';
      this.store.connect(untracked(this.credentials).key, id);
    });
    const timer = setInterval(() => {
      const run = this.store.runValue();
      if (
        run &&
        (run.status === 'QUEUED' ||
          run.status === 'PROCESSING' ||
          run.projectionStatus === 'PENDING')
      )
        this.store.reload();
    }, 10000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
  protected connect(): void {
    this.store.connect(this.credentials().key, this.runId() ?? this.store.id());
  }
  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    if (this.sourceForm().invalid() || this.busy()) return;
    this.store.connect(this.credentials().key, '');
    const request: IngestionRequest = {
      ...this.inputModel(),
      market: 'BR',
      configurationId: null,
    };
    const value = JSON.stringify(request);
    if (value !== this.requestValue) {
      this.requestValue = value;
      this.requestId = crypto.randomUUID();
    }
    const result = await this.store.create({ id: this.requestId, request });
    if (result.status === 'success')
      await this.router.navigate(['/ingestion', result.value.id]);
  }
  protected async publish(event: Event): Promise<void> {
    event.preventDefault();
    const run = this.store.runValue();
    const review = this.reviewModel();
    if (
      !run?.draftHash ||
      !review.identityConfirmed ||
      !review.reason.trim() ||
      !this.selectedCount() ||
      this.busy()
    )
      return;
    await this.store.publish({
      draftHash: run.draftHash,
      baseRevision: run.baseRevision,
      selectedClaims: review.selected.flatMap((selected, index) =>
        selected ? [index] : [],
      ),
      identityConfirmed: review.identityConfirmed,
      reason: review.reason,
    });
  }
}
