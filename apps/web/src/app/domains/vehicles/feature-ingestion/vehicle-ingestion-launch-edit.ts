import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import {
  form,
  FormField,
  max,
  min,
  required,
  validate,
} from '@angular/forms/signals';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideKeyRound, lucidePlay } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/ui/components/button';
import { ZardInputComponent } from '@/ui/components/input';
import { ZardTextareaComponent } from '@/ui/components/textarea';

import {
  type IngestionLaunchPrefill,
  type IngestionRequest,
  type IngestionRun,
  MAX_INGESTION_CONFIGURATIONS,
  samePrefill,
} from '../data/ingestion-contracts';
import { IngestionDetailStore } from './ingestion-detail-store';

/** Splits the one-per-line configuration field into trimmed, unique names. */
export function parseConfigurationNames(value: string): string[] {
  const names: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    const name = line.trim();
    if (name && !names.some((n) => n.toLowerCase() === name.toLowerCase()))
      names.push(name);
  }
  return names;
}

interface LaunchModel {
  key: string;
  sourceUrl: string;
  brand: string;
  model: string;
  modelYear: number;
  configurations: string;
}

/**
 * Starts one import: source, brand, model, model year and the configurations
 * to import, plus the curator key when the session has none. Used by the
 * ingestion page and, prefilled by the agent, inside chat cards.
 */
@Component({
  selector: 'app-vehicle-ingestion-launch-edit',
  imports: [
    FormField,
    NgIcon,
    ZardButtonComponent,
    ZardInputComponent,
    ZardTextareaComponent,
  ],
  providers: [IngestionDetailStore],
  viewProviders: [provideIcons({ lucideKeyRound, lucidePlay })],
  templateUrl: './vehicle-ingestion-launch-edit.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
})
export class VehicleIngestionLaunchEdit {
  readonly prefill = input<IngestionLaunchPrefill>({});
  /** Compact chrome for the chat transcript; the request fields stay editable. */
  readonly compact = input(false, { transform: booleanAttribute });
  /** Shows a cancel button; the host decides what declining means. */
  readonly cancellable = input(false, { transform: booleanAttribute });
  readonly started = output<IngestionRun>();
  readonly cancelled = output<void>();
  protected readonly sourceUrlRequired = $localize`A source URL is required.`;
  protected readonly startingLabel = $localize`Starting…`;
  protected readonly startLabel = $localize`Start extraction`;

  protected readonly store = inject(IngestionDetailStore);
  protected readonly hasKey = this.store.hasKey;
  protected readonly maxConfigurations = MAX_INGESTION_CONFIGURATIONS;
  // Hosts such as the chat card re-emit an equivalent prefill on every
  // agent event; only a prefill with different content resets the fields,
  // so what the curator typed (the key above all) survives.
  protected readonly model = linkedSignal<IngestionLaunchPrefill, LaunchModel>({
    source: this.prefill,
    computation: (prefill, previous) =>
      previous && samePrefill(previous.source, prefill)
        ? previous.value
        : {
            key: '',
            sourceUrl: prefill.sourceUrl ?? '',
            brand: prefill.brand ?? '',
            model: prefill.model ?? '',
            modelYear: prefill.modelYear ?? 2026,
            configurations: (prefill.configurations ?? []).join('\n'),
          },
  });
  protected readonly launchForm = form(this.model, (p) => {
    required(p.sourceUrl);
    validate(p.sourceUrl, ({ value }) =>
      /^https:\/\//.test(value().trim())
        ? undefined
        : {
            kind: 'https',
            message: $localize`Use an HTTPS manufacturer URL.`,
          },
    );
    required(p.brand);
    required(p.model);
    min(p.modelYear, 1900);
    max(p.modelYear, 2200);
    validate(p.configurations, ({ value }) =>
      parseConfigurationNames(value()).length <= MAX_INGESTION_CONFIGURATIONS
        ? undefined
        : {
            kind: 'limit',
            message: $localize`Import at most ${MAX_INGESTION_CONFIGURATIONS}:limit: configurations per run.`,
          },
    );
  });
  protected readonly configurationCount = computed(
    () => parseConfigurationNames(this.model().configurations).length,
  );
  protected readonly busy = this.store.createIsPending;
  protected readonly error = computed(
    () => this.store.createError()?.message ?? '',
  );
  private readonly requestId = signal(crypto.randomUUID());
  private lastRequest = '';

  protected async start(event: Event): Promise<void> {
    event.preventDefault();
    if (this.launchForm().invalid() || this.busy()) return;
    const value = this.model();
    if (!this.hasKey()) {
      if (!value.key.trim()) return;
      this.store.setKey(value.key);
      this.model.update((current) => ({ ...current, key: '' }));
    }
    const request: IngestionRequest = {
      sourceUrl: value.sourceUrl.trim(),
      brand: value.brand.trim(),
      model: value.model.trim(),
      market: 'BR',
      modelYear: Number(value.modelYear),
      configurations: parseConfigurationNames(value.configurations),
    };
    // The request UUID is the idempotency key: a retry of the same input
    // reuses it, a changed input gets a new one.
    const encoded = JSON.stringify(request);
    if (encoded !== this.lastRequest) {
      this.lastRequest = encoded;
      this.requestId.set(crypto.randomUUID());
    }
    const result = await this.store.create({ id: this.requestId(), request });
    if (result.status === 'success') this.started.emit(result.value);
  }
}
