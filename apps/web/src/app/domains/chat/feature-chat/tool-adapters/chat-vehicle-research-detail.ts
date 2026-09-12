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

const referenceSchema = z.object({
  id: z.string().uuid(),
  reviewReady: z.boolean().optional(),
});

@Component({
  selector: 'app-chat-vehicle-research-detail',
  imports: [VehicleResearchDetail],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'block min-w-0 w-full scroll-mt-4 rounded-xl focus-visible:outline-2 focus-visible:outline-ring',
    tabindex: '-1',
    '[attr.data-research-id]': 'reference()?.id ?? null',
  },
  template: `
    @if (reference(); as reference) {
      <app-vehicle-research-detail
        [requestId]="reference.id"
        [reviewInitiallyOpen]="reference.reviewReady ?? false"
      />
    } @else {
      <p
        class="rounded-xl border p-4 text-sm text-muted-foreground"
        role="status"
      >
        {{ toolCall().status === 'complete' ? failed : connecting }}
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
  protected readonly failed = $localize`Research could not be opened. Ask SpecSync to try again.`;
  protected readonly connecting = $localize`Connecting to vehicle research…`;
}
