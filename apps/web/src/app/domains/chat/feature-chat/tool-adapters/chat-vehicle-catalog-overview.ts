import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { AngularToolCall, ToolRenderer } from '@copilotkit/angular';

import {
  catalogPageSchema,
  failureSchema,
  type VehicleConfiguration,
  type VehicleQuestion,
} from '../../../vehicles/api/contracts';
import { VehicleCatalogOverview } from '../../../vehicles/api/features';
import { parseResult } from '../../util/parse-result';
import { CHAT_CARD_ACTIONS } from './chat-card-actions';
import {
  catalogPagePrompt,
  vehicleComparisonPrompt,
  vehicleQuestionPrompt,
} from './vehicle-prompts';

@Component({
  selector: 'app-chat-vehicle-catalog-overview',
  imports: [VehicleCatalogOverview],
  template: `@for (notice of result()?.notices ?? []; track $index) {
      <p class="mb-2 text-sm text-muted-foreground" role="status">
        {{ notice }}
      </p>
    }
    @if (result()?.items?.length === 0 && !result()?.hasMore) {
      @if (!result()?.notices?.length) {
        <p class="text-sm text-muted-foreground" role="status" i18n>
          No configurations found for {{ query() }}.
        </p>
      }
    } @else {
      <app-vehicle-catalog-overview
        [page]="result()"
        [failure]="failure()?.message"
        [complete]="toolCall().status === 'complete'"
        [shortlist]="shortlist()"
        (shortlistChanged)="shortlistChanged.emit($event)"
        (questionRequested)="ask($event)"
        (comparisonRequested)="compare($event)"
      />
    }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
})
export class ChatVehicleCatalogOverview
  implements ToolRenderer<Record<string, unknown>>
{
  readonly toolCall =
    input.required<AngularToolCall<Record<string, unknown>>>();
  readonly shortlist = input<VehicleConfiguration[] | undefined>();
  readonly shortlistChanged = output<VehicleConfiguration[]>();
  protected readonly actions = inject(CHAT_CARD_ACTIONS, { optional: true });
  // CopilotKit replaces the tool call object on every transcript update;
  // parsing only when the result text changes keeps the parsed objects
  // stable, so the vehicle feature keeps its local state and reloads nothing.
  private readonly resultText = computed(() => this.toolCall().result);
  protected readonly result = computed(() =>
    parseResult(this.resultText(), catalogPageSchema),
  );
  protected readonly failure = computed(() =>
    parseResult(this.resultText(), failureSchema),
  );
  protected readonly query = computed(() => {
    const args = this.toolCall().args;
    return [
      args['q'] || $localize`this search`,
      args['market'],
      args['modelYear'],
    ]
      .filter((value) => typeof value === 'string' || typeof value === 'number')
      .join(' · ');
  });
  protected ask(question: VehicleQuestion): void {
    // The next page is navigation, not a question: it is sent with the
    // original search arguments instead of being drafted for editing.
    if (question.kind === 'catalog-page')
      this.actions?.send(
        catalogPagePrompt(
          question,
          this.toolCall().args,
          this.result()?.nextSearches,
        ),
      );
    else this.actions?.draft(vehicleQuestionPrompt(question));
  }
  protected compare(vehicles: VehicleConfiguration[]): void {
    this.actions?.send(vehicleComparisonPrompt(vehicles));
  }
}
