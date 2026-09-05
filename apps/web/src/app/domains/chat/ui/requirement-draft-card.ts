import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';
import { AngularToolCall, ToolRenderer } from '@copilotkit/angular';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/ui/components/button';
import {
  ZardCardComponent,
  ZardCardContentComponent,
  ZardCardHeaderComponent,
} from '@/ui/components/card';

import {
  formatRequirementDraft,
  RequirementDraft,
} from '../data/requirement-draft';

const COPIED_FEEDBACK_MS = 1500;

/**
 * Card for the frontend tool `presentRequirementDraft`: a requirement the
 * agent wrote, with its acceptance criteria and a copy button. The
 * arguments stream in, so every field is rendered as soon as it exists.
 */
@Component({
  selector: 'app-requirement-draft-card',
  imports: [
    NgIcon,
    ZardButtonComponent,
    ZardCardComponent,
    ZardCardContentComponent,
    ZardCardHeaderComponent,
  ],
  viewProviders: [provideIcons({ lucideCheck, lucideCopy })],
  template: `
    @let draft = toolCall().args;
    <z-card class="max-w-xl gap-0 py-0" [attr.data-status]="toolCall().status">
      <z-card-header
        class="flex flex-row items-center justify-between gap-3 border-b px-4 py-2.5"
      >
        <span class="font-mono text-[10px] text-muted-foreground uppercase">
          Requirement draft
        </span>
        <button
          z-button
          zType="ghost"
          zSize="sm"
          type="button"
          [disabled]="toolCall().status !== 'complete'"
          (click)="onCopy(draft)"
        >
          <ng-icon
            [name]="copied() ? 'lucideCheck' : 'lucideCopy'"
            aria-hidden="true"
          />
          {{ copied() ? 'Copied' : 'Copy' }}
        </button>
      </z-card-header>
      <z-card-content class="flex flex-col gap-3 px-4 py-3 text-sm">
        @if (draft.title) {
          <h3 class="font-semibold text-foreground">{{ draft.title }}</h3>
        }
        @if (draft.statement) {
          <p class="text-foreground">{{ draft.statement }}</p>
        }
        @if (draft.rationale) {
          <p class="text-muted-foreground">{{ draft.rationale }}</p>
        }
        @if (draft.acceptanceCriteria?.length) {
          <div>
            <p
              class="mb-1 font-mono text-[10px] text-muted-foreground uppercase"
            >
              Acceptance criteria
            </p>
            <ul class="list-disc space-y-1 pl-5">
              @for (criterion of draft.acceptanceCriteria; track $index) {
                <li>{{ criterion }}</li>
              }
            </ul>
          </div>
        }
      </z-card-content>
    </z-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class RequirementDraftCard implements ToolRenderer<RequirementDraft> {
  readonly toolCall = input.required<AngularToolCall<RequirementDraft>>();

  protected readonly copied = signal(false);

  protected async onCopy(draft: Partial<RequirementDraft>): Promise<void> {
    await navigator.clipboard.writeText(formatRequirementDraft(draft));
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), COPIED_FEEDBACK_MS);
  }
}
