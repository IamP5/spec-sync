import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AngularToolCall, ToolRenderer } from '@copilotkit/angular';

import { ZardCardComponent } from '@/ui/components/card';

import {
  ingestionPlanSchema,
  type IngestionRun,
  type IngestionRunSummary,
} from '../../../vehicles/api/contracts';
import {
  VehicleIngestionLaunchEdit,
  VehicleIngestionRunDetail,
} from '../../../vehicles/api/features';
import { IngestionActivity } from '../../data/ingestion-activity';
import { parseResult } from '../../util/parse-result';

/**
 * Renders the server tool `prepareVehicleIngestion`: a prefilled launch
 * form and the form link. The run started here is shown inline for this
 * session; the persisted run can always be reopened on the ingestion page.
 */
@Component({
  selector: 'app-chat-vehicle-ingestion-plan-edit',
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
      @if (runId(); as runId) {
        <app-vehicle-ingestion-run-detail
          [runId]="runId"
          compact
          (runChanged)="report($event)"
        />
        <p class="mt-3 text-xs text-muted-foreground">
          <a class="underline" [routerLink]="['/ingestion', runId]"
            >Open this import on the ingestion page</a
          >
        </p>
      } @else if (plan(); as plan) {
        <strong>Import ready to start</strong>
        <p class="mt-1 mb-3 text-muted-foreground">{{ plan.message }}</p>
        <app-vehicle-ingestion-launch-edit
          [prefill]="plan.request"
          compact
          (started)="onStarted($event)"
        />
        <p class="mt-3 text-xs text-muted-foreground">
          <a
            class="underline"
            [routerLink]="'/ingestion'"
            [queryParams]="query()"
            >Open the ingestion page instead</a
          >
        </p>
      } @else {
        <p class="text-muted-foreground" role="status">
          {{
            toolCall().status === 'complete'
              ? 'No valid import plan returned.'
              : 'Preparing the import…'
          }}
        </p>
      }
    </z-card>
  `,
})
export class ChatVehicleIngestionPlanEdit
  implements ToolRenderer<Record<string, unknown>>
{
  readonly toolCall =
    input.required<AngularToolCall<Record<string, unknown>>>();
  private readonly activity = inject(IngestionActivity);
  protected readonly plan = computed(() =>
    parseResult(this.toolCall().result, ingestionPlanSchema),
  );
  protected readonly runId = signal('');
  protected readonly query = computed(() => {
    const request = this.plan()?.request;
    return request
      ? {
          sourceUrl: request.sourceUrl,
          brand: request.brand,
          model: request.model,
          modelYear: request.modelYear,
          configurations: request.configurations.join('\n'),
        }
      : {};
  });

  protected onStarted(run: IngestionRun): void {
    this.runId.set(run.id);
  }

  protected report(summary: IngestionRunSummary): void {
    this.activity.report(summary);
  }
}
