import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AngularToolCall, ToolRenderer } from '@copilotkit/angular';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCircleAlert,
  lucideCircleCheck,
  lucideTriangleAlert,
} from '@ng-icons/lucide';

import { ZardBadgeComponent } from '@/ui/components/badge';
import {
  ZardCardComponent,
  ZardCardContentComponent,
  ZardCardHeaderComponent,
} from '@/ui/components/card';
import { ZardProgressComponent } from '@/ui/components/progress';
import { ZardSpinnerComponent } from '@/ui/components/spinner';

import {
  parseRequirementQualityResult,
  RequirementQualityArgs,
  RequirementQualityResult,
} from '../data/requirement-quality';

const VERDICT_LABELS: Record<RequirementQualityResult['verdict'], string> = {
  good: 'Testable',
  'needs-work': 'Needs work',
  poor: 'Rewrite',
};

/**
 * Card for the server tool `checkRequirementQuality`: the checked statement,
 * its score and the findings. Shows a pending state while the agent is still
 * calling the tool.
 */
@Component({
  selector: 'app-requirement-quality-card',
  imports: [
    NgIcon,
    ZardBadgeComponent,
    ZardCardComponent,
    ZardCardContentComponent,
    ZardCardHeaderComponent,
    ZardProgressComponent,
    ZardSpinnerComponent,
  ],
  viewProviders: [
    provideIcons({ lucideCircleAlert, lucideCircleCheck, lucideTriangleAlert }),
  ],
  template: `
    <z-card class="max-w-xl gap-0 py-0" [attr.data-status]="toolCall().status">
      <z-card-header
        class="flex flex-row items-center justify-between gap-3 border-b px-4 py-2.5"
      >
        <span class="font-mono text-[10px] text-muted-foreground uppercase">
          Requirement check
        </span>
        @let verdict = result()?.verdict;
        @if (verdict) {
          <z-badge
            [zType]="
              verdict === 'good'
                ? 'secondary'
                : verdict === 'poor'
                  ? 'destructive'
                  : 'outline'
            "
          >
            {{ labels[verdict] }}
          </z-badge>
        }
      </z-card-header>
      <z-card-content class="flex flex-col gap-3 px-4 py-3 text-sm">
        @let checked = result();
        @if (checked) {
          <blockquote
            class="border-l-2 border-border pl-3 text-muted-foreground italic"
          >
            {{ checked.requirement }}
          </blockquote>
          <div class="flex items-center gap-3">
            <z-progress class="h-1.5 flex-1" [value]="checked.score" />
            <span class="font-mono text-xs tabular-nums"
              >{{ checked.score }}/100</span
            >
          </div>
          @if (checked.findings.length) {
            <ul class="flex flex-col gap-2">
              @for (finding of checked.findings; track $index) {
                <li class="flex items-start gap-2">
                  <ng-icon
                    [name]="
                      finding.severity === 'error'
                        ? 'lucideCircleAlert'
                        : 'lucideTriangleAlert'
                    "
                    class="mt-0.5 shrink-0"
                    [class]="
                      finding.severity === 'error'
                        ? 'text-destructive'
                        : 'text-warning'
                    "
                    [attr.aria-label]="finding.severity"
                  />
                  <span>{{ finding.message }}</span>
                </li>
              }
            </ul>
          } @else {
            <p class="flex items-center gap-2 text-success">
              <ng-icon name="lucideCircleCheck" aria-hidden="true" />
              No issues found.
            </p>
          }
        } @else {
          <p class="flex items-center gap-2 text-muted-foreground">
            <z-spinner class="size-4" zAriaLabel="Checking" />
            Checking
            @if (toolCall().args.requirement) {
              <span class="truncate">“{{ toolCall().args.requirement }}”</span>
            }
          </p>
        }
      </z-card-content>
    </z-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class RequirementQualityCard
  implements ToolRenderer<RequirementQualityArgs>
{
  readonly toolCall = input.required<AngularToolCall<RequirementQualityArgs>>();

  protected readonly labels = VERDICT_LABELS;

  protected readonly result = computed(() =>
    parseRequirementQualityResult(this.toolCall().result),
  );
}
