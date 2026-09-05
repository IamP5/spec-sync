import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AngularToolCall, ToolRenderer } from '@copilotkit/angular';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideWrench } from '@ng-icons/lucide';

import { ZardSpinnerComponent } from '@/ui/components/spinner';

/**
 * Fallback rendering for any tool call without a dedicated card: the tool
 * name and whether it is still running. Keeps server-side work visible in
 * the transcript instead of silently dropping it.
 */
@Component({
  selector: 'app-tool-call-card',
  imports: [NgIcon, ZardSpinnerComponent],
  viewProviders: [provideIcons({ lucideCheck, lucideWrench })],
  template: `
    <div
      class="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 font-mono text-[11px] text-muted-foreground"
      [attr.data-status]="toolCall().status"
    >
      <ng-icon name="lucideWrench" aria-hidden="true" />
      <span>{{ toolCall().name }}</span>
      @if (toolCall().status === 'complete') {
        <ng-icon name="lucideCheck" class="text-success" aria-label="Done" />
      } @else {
        <z-spinner class="size-3" zAriaLabel="Running" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class ToolCallCard implements ToolRenderer<Record<string, unknown>> {
  readonly toolCall =
    input.required<AngularToolCall<Record<string, unknown>>>();
}
