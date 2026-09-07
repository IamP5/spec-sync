import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { AngularToolCall, ToolRenderer } from '@copilotkit/angular';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideFileText, lucidePlay } from '@ng-icons/lucide';
import { z } from 'zod';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardCardComponent } from '@/ui/components/card';
import { ZardSpinnerComponent } from '@/ui/components/spinner';

import { sourcePreviewSchema } from '../../../vehicles/api/contracts';
import { parseResult } from '../../util/parse-result';
import { CHAT_CARD_ACTIONS } from './chat-card-actions';
import { vehicleIngestionPrompt } from './vehicle-prompts';

const argsSchema = z.object({
  sourceUrl: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  modelYear: z.coerce.number().optional(),
});
/** Tool failures and Mastra input-validation errors both carry a message. */
const failureSchema = z.union([
  z.object({ status: z.literal('ERROR'), message: z.string() }),
  z.object({ error: z.literal(true), message: z.string() }),
]);

/**
 * Renders the configurations one official source presents (server tool
 * `previewVehicleSource`) and lets the curator tick the ones to import; the
 * choice goes back to the agent as a prompt, which then starts the run.
 */
@Component({
  selector: 'app-chat-vehicle-source-overview',
  imports: [
    NgIcon,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardCardComponent,
    ZardSpinnerComponent,
  ],
  viewProviders: [provideIcons({ lucideFileText, lucidePlay })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
  template: `
    <z-card class="rounded-xl p-4 text-sm shadow-none">
      @if (preview(); as preview) {
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <strong class="flex items-center gap-1">
              <ng-icon name="lucideFileText" aria-hidden="true" />
              Configurations in the source
            </strong>
            <p class="mt-1 break-all text-muted-foreground">
              {{ preview.source.title }}
              @if (preview.source.pageCount) {
                · {{ preview.source.pageCount }} pages
              }
            </p>
          </div>
          <z-badge zType="secondary"
            >{{ preview.configurations.length }} found</z-badge
          >
        </div>
        @if (preview.modelYearNote) {
          <p class="mt-2 text-xs text-muted-foreground">
            {{ preview.modelYearNote }}
          </p>
        }
        @if (preview.configurations.length) {
          <ul class="mt-3 space-y-2" aria-label="Configurations">
            @for (
              configuration of preview.configurations;
              track configuration.name
            ) {
              <li>
                <label
                  class="flex cursor-pointer items-start gap-2 rounded-lg border p-2"
                >
                  <input
                    type="checkbox"
                    class="mt-0.5 size-4 accent-primary"
                    [checked]="isSelected(configuration.name)"
                    [disabled]="!actions"
                    (change)="toggle(configuration.name)"
                  />
                  <span class="min-w-0">
                    <span class="font-medium">{{ configuration.name }}</span>
                    @if (configuration.powertrain) {
                      <span class="text-muted-foreground">
                        · {{ configuration.powertrain }}</span
                      >
                    }
                    <span class="mt-0.5 block text-xs text-muted-foreground">
                      {{ configuration.locator }}
                    </span>
                  </span>
                </label>
              </li>
            }
          </ul>
          @if (preview.legend.length) {
            <p class="mt-3 text-xs text-muted-foreground">
              Legend:
              @for (
                entry of preview.legend;
                track entry.symbol;
                let last = $last
              ) {
                {{ entry.symbol }} = {{ entry.meaning }}{{ last ? '' : '; ' }}
              }
            </p>
          }
          @if (preview.notes.length) {
            <ul
              class="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground"
            >
              @for (note of preview.notes; track $index) {
                <li>{{ note }}</li>
              }
            </ul>
          }
          @if (actions) {
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <button
                z-button
                zSize="sm"
                type="button"
                data-action="import"
                [zDisabled]="!selectedCount()"
                (click)="importSelected()"
              >
                <ng-icon name="lucidePlay" aria-hidden="true" />
                Import {{ selectedCount() }} selected
              </button>
              <button
                z-button
                zType="outline"
                zSize="sm"
                type="button"
                data-action="import-all"
                (click)="importAll()"
              >
                Import all ({{ preview.configurations.length }})
              </button>
            </div>
          }
        } @else {
          <p class="mt-3 text-muted-foreground">{{ preview.message }}</p>
        }
      } @else if (failure(); as failure) {
        <strong>Source could not be read</strong>
        <p class="mt-1 text-muted-foreground" role="status">
          {{ failure.message }}
        </p>
      } @else {
        <p class="flex items-center gap-2" role="status">
          <z-spinner class="size-4" zAriaLabel="Reading the source" />
          {{
            toolCall().status === 'complete'
              ? 'No valid preview returned.'
              : 'Reading the source and listing its configurations…'
          }}
        </p>
      }
    </z-card>
  `,
})
export class ChatVehicleSourceOverview
  implements ToolRenderer<Record<string, unknown>>
{
  readonly toolCall =
    input.required<AngularToolCall<Record<string, unknown>>>();
  protected readonly actions = inject(CHAT_CARD_ACTIONS, { optional: true });
  protected readonly preview = computed(() =>
    parseResult(this.toolCall().result, sourcePreviewSchema),
  );
  protected readonly failure = computed(() =>
    parseResult(this.toolCall().result, failureSchema),
  );
  private readonly args = computed(() =>
    parseResult(this.toolCall().args, argsSchema),
  );
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedCount = computed(() => this.selected().size);

  protected isSelected(name: string): boolean {
    return this.selected().has(name);
  }
  protected toggle(name: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }
  protected importSelected(): void {
    this.send([...this.selected()]);
  }
  protected importAll(): void {
    this.send([]);
  }
  private send(configurations: string[]): void {
    const preview = this.preview();
    const args = this.args();
    if (!preview) return;
    this.actions?.send(
      vehicleIngestionPrompt({
        sourceUrl: preview.source.url,
        brand: args?.brand ?? '',
        model: args?.model ?? '',
        modelYear: args?.modelYear ?? 0,
        configurations,
      }),
    );
  }
}
