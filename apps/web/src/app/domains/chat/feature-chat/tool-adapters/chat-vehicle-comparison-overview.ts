import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { AngularToolCall, ToolRenderer } from '@copilotkit/angular';

import {
  comparisonSchema,
  failureSchema,
  type VehicleQuestion,
} from '../../../vehicles/api/contracts';
import { VehicleComparisonOverview } from '../../../vehicles/api/features';
import { parseResult } from '../../util/parse-result';
import { CHAT_CARD_ACTIONS } from './chat-card-actions';
import { vehicleQuestionPrompt } from './vehicle-prompts';

@Component({
  selector: 'app-chat-vehicle-comparison-overview',
  imports: [VehicleComparisonOverview],
  template: `<app-vehicle-comparison-overview
    [comparison]="result()"
    [failure]="failure()?.message"
    [complete]="toolCall().status === 'complete'"
    (questionRequested)="ask($event)"
    [questionsEnabled]="!!actions"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
})
export class ChatVehicleComparisonOverview
  implements ToolRenderer<Record<string, unknown>>
{
  readonly toolCall =
    input.required<AngularToolCall<Record<string, unknown>>>();
  protected readonly actions = inject(CHAT_CARD_ACTIONS, { optional: true });
  // CopilotKit replaces the tool call object on every transcript update;
  // parsing only when the result text changes keeps the parsed objects
  // stable, so the vehicle feature keeps its local state and reloads nothing.
  private readonly resultText = computed(() => this.toolCall().result);
  protected readonly result = computed(() =>
    parseResult(this.resultText(), comparisonSchema),
  );
  protected readonly failure = computed(() =>
    parseResult(this.resultText(), failureSchema),
  );
  protected ask(question: VehicleQuestion): void {
    this.actions?.draft(vehicleQuestionPrompt(question));
  }
}
