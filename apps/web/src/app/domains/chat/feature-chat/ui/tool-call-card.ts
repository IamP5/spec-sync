import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AngularToolCall, ToolRenderer } from '@copilotkit/angular';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideWrench } from '@ng-icons/lucide';

import {
  ZardMarkerComponent,
  ZardMarkerContentComponent,
  ZardMarkerIconComponent,
} from '@/ui/components/marker';
import { ZardSpinnerComponent } from '@/ui/components/spinner';

/**
 * Fallback rendering for any tool call without a dedicated card: a marker
 * row with the tool name and whether it is still running. Keeps server-side
 * work visible in the transcript instead of silently dropping it.
 */
@Component({
  selector: 'app-tool-call-card',
  imports: [
    NgIcon,
    ZardMarkerComponent,
    ZardMarkerContentComponent,
    ZardMarkerIconComponent,
    ZardSpinnerComponent,
  ],
  viewProviders: [provideIcons({ lucideCheck, lucideWrench })],
  template: `
    @let done = toolCall().status === 'complete';
    <z-marker
      class="font-mono text-[11px]"
      [attr.role]="done ? null : 'status'"
      [attr.data-status]="toolCall().status"
    >
      <z-marker-icon>
        @if (done) {
          <ng-icon name="lucideCheck" class="text-success" />
        } @else {
          <z-spinner class="size-4" zAriaLabel="Running" />
        }
      </z-marker-icon>
      <z-marker-content [class]="done ? '' : 'shimmer'">
        <ng-icon name="lucideWrench" class="mr-1 inline size-3" />
        {{ label() }}
      </z-marker-content>
    </z-marker>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ToolCallCard implements ToolRenderer<Record<string, unknown>> {
  readonly toolCall =
    input.required<AngularToolCall<Record<string, unknown>>>();
  /** Mastra's built-in tools get a readable label; others show their name. */
  protected readonly label = computed(
    () =>
      (
        ({ skill: 'Reading the ingestion procedure' }) as Record<string, string>
      )[this.toolCall().name ?? ''] ?? this.toolCall().name,
  );
}
