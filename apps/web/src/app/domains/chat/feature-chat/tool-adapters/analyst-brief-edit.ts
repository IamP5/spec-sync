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
  maxLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';

import { ZardButtonComponent } from '@/ui/components/button';
import { ZardInputComponent } from '@/ui/components/input';

import type { VehicleConfiguration } from '../../../vehicles/api/contracts';
import {
  type AnalystContext,
  analystContextSchema,
  type AnalystFocusArea,
} from '../../data/competitive-workspace-actions';
import type { CompetitiveAttribute } from '../../data/competitive-workspace-contracts';

@Component({
  selector: 'app-analyst-brief-edit',
  imports: [FormField, ZardButtonComponent, ZardInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: ` <form
    (submit)="apply($event)"
    class="space-y-4 rounded-xl border bg-muted/30 p-4"
    aria-label="Competitive analysis brief"
  >
    <div>
      <h3 class="font-semibold">Analysis brief</h3>
      <p class="text-xs text-muted-foreground">
        Choose a Ford baseline, competitors and the measures to investigate.
        Changes apply together.
      </p>
    </div>
    <label class="block space-y-1 text-sm"
      >Objective<textarea
        class="flex min-h-20 w-full rounded-lg border bg-background px-3 py-2"
        [formField]="briefForm.objective"
      ></textarea>
    </label>
    <div class="grid grid-cols-2 gap-3">
      <label class="block space-y-1 text-sm"
        >Market code<input
          z-input
          placeholder="e.g. BR"
          [formField]="briefForm.market"
      /></label>
      <label class="block space-y-1 text-sm"
        >Model year<input
          z-input
          inputmode="numeric"
          placeholder="e.g. 2026"
          [formField]="briefForm.modelYear"
      /></label>
    </div>
    <label class="block space-y-1 text-sm"
      >Ford baseline<select
        class="h-10 w-full rounded-lg border bg-background px-2"
        [formField]="briefForm.baselineConfigurationId"
      >
        <option value="">Choose from selected Ford configurations</option>
        @for (vehicle of fordConfigurations(); track vehicle.id) {
          <option [value]="vehicle.id">
            {{ vehicle.model }} · {{ vehicle.name }} · {{ vehicle.market }}
            {{ vehicle.modelYear }}
          </option>
        }
      </select></label
    >
    <p class="text-xs text-muted-foreground">
      {{ selectedConfigurations().length }} of 5 configurations selected in the
      catalog. The remaining selected vehicles are competitors.
    </p>
    @if (selectedConfigurations().length) {
      <ul
        class="flex flex-wrap gap-1 text-xs"
        aria-label="Selected configurations"
      >
        @for (vehicle of selectedConfigurations(); track vehicle.id) {
          <li class="rounded-full border px-2 py-1">
            {{ vehicle.brand }} {{ vehicle.model }} · {{ vehicle.name }}
          </li>
        }
      </ul>
    }
    <fieldset class="space-y-2">
      <legend class="text-sm font-medium">Priorities</legend>
      <div class="grid grid-cols-2 gap-2">
        @for (area of focusAreas; track area.value) {
          <label class="flex items-center gap-2 text-sm"
            ><input
              type="checkbox"
              [formField]="briefForm.priorities[area.value]"
            />{{ area.label }}</label
          >
        }
      </div>
    </fieldset>
    <fieldset class="space-y-2">
      <legend class="text-sm font-medium">
        Specification attributes (up to 12)
      </legend>
      <div
        class="max-h-48 space-y-2 overflow-auto rounded-lg border bg-background p-3"
      >
        @for (
          attribute of model().attributeChoices;
          track attribute.code;
          let index = $index
        ) {
          <label class="flex items-center gap-2 text-sm"
            ><input
              type="checkbox"
              [formField]="briefForm.attributeChoices[index].selected"
            />{{ attribute.label
            }}{{ attribute.unit ? ' (' + attribute.unit + ')' : '' }}</label
          >
        }
      </div>
    </fieldset>
    <p class="text-xs text-muted-foreground">
      Inputs stay local until you apply the brief.
    </p>
    @if (validationMessage(); as message) {
      <p class="text-sm text-destructive" role="status">{{ message }}</p>
    }
    <button
      z-button
      type="submit"
      [zDisabled]="!enabled() || briefForm().invalid() || !!validationMessage()"
    >
      Apply analysis brief
    </button>
  </form>`,
})
export class AnalystBriefEdit {
  readonly context = input.required<AnalystContext>();
  readonly availableAttributes = input<CompetitiveAttribute[]>([]);
  readonly selectedConfigurations = input<VehicleConfiguration[]>([]);
  readonly enabled = input(true);
  readonly briefApplied = output<AnalystContext>();
  protected readonly focusAreas: { value: AnalystFocusArea; label: string }[] =
    [
      { value: 'powertrain', label: 'Powertrain' },
      { value: 'performance', label: 'Performance' },
      { value: 'dimensions', label: 'Dimensions' },
      { value: 'equipment', label: 'Equipment' },
    ];
  protected readonly fordConfigurations = computed(() =>
    this.selectedConfigurations().filter(
      (vehicle) => vehicle.brand.toLocaleLowerCase() === 'ford',
    ),
  );
  protected readonly model = linkedSignal(() => {
    const context = this.context();
    return {
      objective: context.objective,
      market: context.market ?? '',
      modelYear: context.modelYear?.toString() ?? '',
      baselineConfigurationId: context.baselineConfigurationId ?? '',
      attributeChoices: this.availableAttributes().map((attribute) => ({
        code: attribute.code,
        label: attribute.label,
        unit: attribute.unit ?? '',
        selected: context.attributes.includes(attribute.code),
      })),
      priorities: {
        powertrain: context.focusAreas.includes('powertrain'),
        performance: context.focusAreas.includes('performance'),
        dimensions: context.focusAreas.includes('dimensions'),
        equipment: context.focusAreas.includes('equipment'),
      },
    };
  });
  protected readonly briefForm = form(this.model, (path) => {
    disabled(path, { when: () => !this.enabled() });
    required(path.objective);
    maxLength(path.objective, 500);
    validate(path.market, ({ value }) =>
      !value() || /^[A-Z]{2}$/.test(value())
        ? undefined
        : {
            kind: 'market',
            message: 'Use a two-letter uppercase market code.',
          },
    );
    validate(path.modelYear, ({ value }) =>
      !value() ||
      (/^\d{4}$/.test(value()) &&
        Number(value()) >= 1900 &&
        Number(value()) <= 2200)
        ? undefined
        : { kind: 'year', message: 'Use a model year from 1900 to 2200.' },
    );
  });
  protected readonly validationMessage = computed(() => {
    const model = this.model(),
      selected = this.selectedConfigurations();
    if (
      model.baselineConfigurationId &&
      !this.fordConfigurations().some(
        (vehicle) => vehicle.id === model.baselineConfigurationId,
      )
    )
      return 'Select a Ford baseline from the current selection.';
    if (
      selected.some(
        (vehicle) =>
          (model.market && vehicle.market !== model.market) ||
          (model.modelYear && vehicle.modelYear !== Number(model.modelYear)),
      )
    )
      return 'Selected configurations must match the market and model year. Adjust the scope or selection.';
    if (
      model.attributeChoices.filter((attribute) => attribute.selected).length >
      12
    )
      return 'Choose up to 12 specification attributes.';
    return '';
  });
  protected apply(event: Event): void {
    event.preventDefault();
    this.requestApply();
  }
  requestApply(): void {
    if (!this.enabled() || this.validationMessage()) return;
    void submit(this.briefForm, async () => {
      const model = this.model();
      const parsed = analystContextSchema.safeParse({
        objective: model.objective,
        attributes: model.attributeChoices
          .filter((attribute) => attribute.selected)
          .map((attribute) => attribute.code),
        focusAreas: this.focusAreas
          .filter((area) => model.priorities[area.value])
          .map((area) => area.value),
        market: model.market || undefined,
        modelYear: model.modelYear ? Number(model.modelYear) : undefined,
        baselineConfigurationId: model.baselineConfigurationId || undefined,
        selectedConfigurationIds: this.selectedConfigurations().map(
          (vehicle) => vehicle.id,
        ),
      });
      if (parsed.success) this.briefApplied.emit(parsed.data);
    });
  }
}
