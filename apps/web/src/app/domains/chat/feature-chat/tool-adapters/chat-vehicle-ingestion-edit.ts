import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  HumanInTheLoopToolCall,
  HumanInTheLoopToolRenderer,
} from '@copilotkit/angular';

import { ZardCardComponent } from '@/ui/components/card';

import {
  type IngestionLaunchPrefill,
  type IngestionRun,
  type IngestionRunSummary,
  type IngestionStartArgs,
  ingestionStartArgsSchema,
  type IngestionStartResult,
  ingestionStartResultSchema,
  samePrefill,
} from '../../../vehicles/api/contracts';
import {
  VehicleIngestionLaunchEdit,
  VehicleIngestionRunDetail,
} from '../../../vehicles/api/features';
import { IngestionActivity } from '../../data/ingestion-activity';
import { parseResult } from '../../util/parse-result';

/**
 * Human-in-the-loop renderer of the browser tool `startVehicleIngestion`.
 * While the agent waits, the curator sees the prefilled launch form, enters
 * the key (never shared with the agent) and starts or declines the run; the
 * answer goes back to the agent as the tool result. Once answered, the card
 * shows the run itself: progress, evidence review and publication.
 */
@Component({
  selector: 'app-chat-vehicle-ingestion-edit',
  imports: [
    RouterLink,
    VehicleIngestionLaunchEdit,
    VehicleIngestionRunDetail,
    ZardCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
  template: `
    <z-card class="rounded-xl p-4 text-sm shadow-none">
      @if (result(); as result) {
        @if (result.status === 'STARTED') {
          @if (startedHere()) {
            <app-vehicle-ingestion-run-detail
              [runId]="result.runId"
              compact
              (runChanged)="report($event)"
            />
          }
          <p class="mt-3 text-xs text-muted-foreground">
            <a
              class="underline"
              [routerLink]="['/ingestion', result.runId]"
              i18n
              >See the earlier import</a
            >
          </p>
        } @else {
          <p class="text-muted-foreground" role="status">
            {{ result.message }}
          </p>
        }
      } @else if (toolCall().status === 'complete') {
        <p class="text-muted-foreground" role="status" i18n>
          The import was not started in this browser.
        </p>
      } @else {
        <strong i18n>Start this import?</strong>
        <p class="mt-1 mb-3 text-muted-foreground" i18n>
          Check the scope, then start the extraction with your curator key. The
          agent never receives the key.
        </p>
        <app-vehicle-ingestion-launch-edit
          [prefill]="prefill()"
          compact
          cancellable
          (started)="onStarted($event)"
          (cancelled)="onCancelled()"
        />
      }
    </z-card>
  `,
})
export class ChatVehicleIngestionEdit
  implements HumanInTheLoopToolRenderer<IngestionStartArgs>
{
  readonly toolCall =
    input.required<HumanInTheLoopToolCall<IngestionStartArgs>>();
  private readonly activity = inject(IngestionActivity);
  protected readonly startedHere = signal(false);
  // CopilotKit passes a new tool-call object on every agent event; the
  // prefill only changes when its content does, so the form keeps its edits.
  protected readonly prefill = computed<IngestionLaunchPrefill>(
    () => parseResult(this.toolCall().args, ingestionStartArgsSchema) ?? {},
    { equal: samePrefill },
  );
  protected readonly result = computed<IngestionStartResult | undefined>(() =>
    parseResult(this.toolCall().result, ingestionStartResultSchema),
  );

  protected onStarted(run: IngestionRun): void {
    this.startedHere.set(true);
    this.respond({
      status: 'STARTED',
      runId: run.id,
      runStatus: run.status,
      message: `Import ${run.id} started for ${run.request.brand} ${run.request.model} ${run.request.modelYear}; the browser shows its progress and review.`,
    });
  }

  protected onCancelled(): void {
    this.respond({
      status: 'CANCELLED',
      message: 'The curator did not start the import.',
    });
  }

  protected report(summary: IngestionRunSummary): void {
    this.activity.report(summary);
  }

  private respond(result: IngestionStartResult): void {
    this.toolCall().respond?.(result);
  }
}
