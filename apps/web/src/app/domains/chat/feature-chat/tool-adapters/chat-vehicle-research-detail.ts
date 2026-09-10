import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AngularToolCall, ToolRenderer } from '@copilotkit/angular';
import { z } from 'zod';

import { VehicleResearchDetail } from '../../../vehicles/api/features';
import { parseResult } from '../../util/parse-result';

const referenceSchema = z.object({ id: z.string().uuid() });

@Component({
  selector: 'app-chat-vehicle-research-detail',
  imports: [VehicleResearchDetail],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
  template: `
    @if (reference(); as reference) {
      <app-vehicle-research-detail [requestId]="reference.id" />
    } @else {
      <p
        class="rounded-xl border p-4 text-sm text-muted-foreground"
        role="status"
      >
        {{
          toolCall().status === 'complete'
            ? 'Research could not be opened. Ask SpecSync to try again.'
            : 'Connecting to vehicle research…'
        }}
      </p>
    }
  `,
})
export class ChatVehicleResearchDetail
  implements ToolRenderer<Record<string, unknown>>
{
  readonly toolCall =
    input.required<AngularToolCall<Record<string, unknown>>>();
  protected readonly reference = computed(() =>
    parseResult(this.toolCall().result, referenceSchema),
  );
}
