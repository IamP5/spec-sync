import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
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
  vehicleComparisonPrompt,
  vehicleQuestionPrompt,
} from './vehicle-prompts';

@Component({
  selector: 'app-chat-vehicle-catalog-overview',
  imports: [VehicleCatalogOverview],
  template: `<app-vehicle-catalog-overview
    [page]="result()"
    [failure]="failure()?.message"
    [complete]="toolCall().status === 'complete'"
    (questionRequested)="ask($event)"
    (comparisonRequested)="compare($event)"
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
})
export class ChatVehicleCatalogOverview
  implements ToolRenderer<Record<string, unknown>>
{
  readonly toolCall =
    input.required<AngularToolCall<Record<string, unknown>>>();
  protected readonly actions = inject(CHAT_CARD_ACTIONS, { optional: true });
  protected readonly result = computed(() =>
    parseResult(this.toolCall().result, catalogPageSchema),
  );
  protected readonly failure = computed(() =>
    parseResult(this.toolCall().result, failureSchema),
  );
  protected ask(question: VehicleQuestion): void {
    this.actions?.draft(vehicleQuestionPrompt(question));
  }
  protected compare(vehicles: VehicleConfiguration[]): void {
    this.actions?.send(vehicleComparisonPrompt(vehicles));
  }
}
