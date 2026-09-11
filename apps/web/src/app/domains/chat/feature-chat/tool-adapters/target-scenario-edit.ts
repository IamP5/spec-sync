import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import {
  disabled,
  form,
  FormField,
  required,
  submit,
  validate,
} from '@angular/forms/signals';

import { ZardButtonComponent } from '@/ui/components/button';
import { ZardInputComponent } from '@/ui/components/input';

import type { VehicleConfiguration } from '../../../vehicles/api/contracts';
import type {
  CompetitiveAttribute,
  TargetScenario,
} from '../../data/competitive-workspace-contracts';
import { safeSourceUrl } from '../../util/knowledge-display';

@Component({
  selector: 'app-target-scenario-edit',
  imports: [FormField, JsonPipe, ZardButtonComponent, ZardInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: ` <div class="space-y-4">
    <p class="text-sm text-muted-foreground">
      An analyst-defined target for one metric. Delta is the reported value
      minus your target, in the source metric's unit. A positive or negative
      delta does not imply a better vehicle. Measurement qualifiers are not
      normalized across configurations; check conditions before treating values
      as comparable.
    </p>
    <form
      class="flex flex-wrap items-end gap-3"
      (submit)="apply($event)"
      aria-label="Scenario target"
    >
      <label class="min-w-40 flex-1 space-y-1 text-sm"
        >Numeric attribute<select
          class="h-10 w-full rounded-lg border bg-background px-2"
          [formField]="targetForm.attributeCode"
        >
          @for (attribute of numericAttributes(); track attribute.code) {
            <option [value]="attribute.code">
              {{ attribute.label
              }}{{ attribute.unit ? ' (' + attribute.unit + ')' : '' }}
            </option>
          }
        </select></label
      >
      <label class="min-w-32 flex-1 space-y-1 text-sm"
        >Your target<input
          z-input
          inputmode="decimal"
          placeholder="Enter a target"
          [formField]="targetForm.targetValue"
      /></label>
      <button
        z-button
        type="submit"
        [zDisabled]="!enabled() || targetForm().invalid()"
      >
        Apply target
      </button>
    </form>
    @if (result(); as scenario) {
      <p class="text-sm font-medium">
        {{ scenario.attribute.label }} · target {{ scenario.targetValue }}
        {{ scenario.attribute.unit }}
      </p>
      <ul class="space-y-3" aria-label="Target scenario results">
        @for (item of scenario.items; track item.configurationId) {
          <li class="space-y-2 rounded-lg border p-3">
            <p class="text-sm font-semibold">
              {{ configurationLabel(item.configurationId) }}
            </p>
            @if (item.value !== null) {
              <p class="text-sm">
                Reported {{ item.value }} {{ scenario.attribute.unit }} · delta
                {{ item.delta }} {{ scenario.attribute.unit }}
              </p>
            }
            <p class="text-xs text-muted-foreground">
              {{ item.knowledgeStatus }}
              @if (item.reason) {
                · {{ item.reason }}
              }
            </p>
            @if (hasQualifiers(item.qualifiers)) {
              <details class="text-xs">
                <summary class="cursor-pointer">Measurement qualifiers</summary>
                <pre class="mt-2 whitespace-pre-wrap">{{
                  item.qualifiers | json
                }}</pre>
              </details>
            }
            @for (source of item.evidence; track source.id) {
              <details class="text-sm">
                <summary class="cursor-pointer">
                  {{ source.title }} · {{ source.locator }}
                </summary>
                <p class="mt-2 text-xs text-muted-foreground">
                  Provenance: {{ source.provenance }} · Captured
                  {{ source.capturedOn }}
                  @if (source.publishedOn) {
                    · Published {{ source.publishedOn }}
                  }
                </p>
                <p class="break-all text-xs text-muted-foreground">
                  Stored source: {{ source.path }}
                </p>
                <blockquote class="mt-2 whitespace-pre-wrap border-l-2 pl-3">
                  {{ source.excerpt }}
                </blockquote>
                @for (rawUrl of source.upstreamUrls; track rawUrl) {
                  @if (safeUrl(rawUrl); as url) {
                    <a
                      class="mt-2 inline-block underline underline-offset-4"
                      [href]="url"
                      target="_blank"
                      rel="noopener noreferrer"
                      >Open upstream reference<span class="sr-only">
                        (opens in a new tab)</span
                      ></a
                    >
                  }
                }
              </details>
            }
          </li>
        }
      </ul>
    }
  </div>`,
})
export class TargetScenarioEdit {
  readonly attributeCode = input.required<string>();
  readonly targetValue = input<number>();
  readonly availableAttributes = input<CompetitiveAttribute[]>([]);
  readonly configurations = input<VehicleConfiguration[]>([]);
  readonly result = input<TargetScenario>();
  readonly enabled = input(true);
  readonly targetApplied = output<{
    attributeCode: string;
    targetValue: number;
  }>();
  protected readonly numericAttributes = computed(() =>
    this.availableAttributes().filter(
      (attribute) => attribute.valueType === 'NUMBER',
    ),
  );
  protected readonly model = linkedSignal(() => ({
    attributeCode: this.attributeCode(),
    targetValue: this.targetValue()?.toString() ?? '',
  }));
  protected readonly targetForm = form(this.model, (path) => {
    disabled(path, { when: () => !this.enabled() });
    required(path.attributeCode);
    required(path.targetValue);
    validate(path.attributeCode, ({ value }) =>
      this.numericAttributes().some((attribute) => attribute.code === value())
        ? undefined
        : { kind: 'metric', message: 'Choose an available numeric attribute.' },
    );
    validate(path.targetValue, ({ value }) =>
      value().trim() && Number.isFinite(Number(value()))
        ? undefined
        : { kind: 'target', message: 'Enter a finite numeric target.' },
    );
  });
  protected readonly safeUrl = safeSourceUrl;
  protected hasQualifiers(value: Record<string, unknown>): boolean {
    return Object.keys(value).length > 0;
  }
  protected configurationLabel(id: string): string {
    const vehicle = this.configurations().find((item) => item.id === id);
    return vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.name}` : id;
  }
  protected apply(event: Event): void {
    event.preventDefault();
    if (!this.enabled()) return;
    void submit(this.targetForm, async () => {
      const model = this.model();
      this.targetApplied.emit({
        attributeCode: model.attributeCode,
        targetValue: Number(model.targetValue),
      });
    });
  }
}
