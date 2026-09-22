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
  type CatalogPage,
  catalogPageSchema,
  catalogSearchSchema,
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
  // Notices and the empty outcome are quiet lines in the reply column, the
  // same column the assistant text and the tool notes use; only a catalog
  // with vehicles takes the wider surface.
  template: `@for (notice of result()?.notices ?? []; track $index) {
      <p
        class="mx-auto mb-2 w-full max-w-3xl text-sm text-muted-foreground"
        role="status"
      >
        {{ notice }}
      </p>
    }
    @if (result()?.items?.length === 0 && !result()?.hasMore) {
      @if (!result()?.notices?.length) {
        <p
          class="mx-auto w-full max-w-3xl text-sm text-muted-foreground"
          role="status"
          i18n
        >
          No configurations found for {{ query() }}.
        </p>
      }
    } @else {
      <app-vehicle-catalog-overview
        [page]="page()"
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
  /**
   * The page with its continuation. A result recorded before the server
   * returned continuation queries names its search only in the tool
   * arguments, so the continuation is derived from them once, here, and the
   * catalog feature pages on without knowing about tool calls.
   */
  protected readonly page = computed<CatalogPage | undefined>(() => {
    const page = this.result();
    if (!page || page.nextSearches || !page.hasMore) return page;
    const args = this.toolCall().args;
    const continuation = catalogSearchSchema.safeParse({
      q: typeof args['q'] === 'string' ? args['q'] : '',
      market: typeof args['market'] === 'string' ? args['market'] : undefined,
      modelYear:
        typeof args['modelYear'] === 'number' ? args['modelYear'] : undefined,
      limit: Math.min(20, Math.max(1, page.limit)),
      offset: page.offset + page.items.length,
    });
    return continuation.success
      ? { ...page, nextSearches: [continuation.data] }
      : page;
  });
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
    this.actions?.draft(vehicleQuestionPrompt(question));
  }
  protected compare(vehicles: VehicleConfiguration[]): void {
    this.actions?.send(vehicleComparisonPrompt(vehicles));
  }
}
