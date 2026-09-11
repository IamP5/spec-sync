import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

import { ZardButtonComponent } from '@/ui/components/button';

import type { EvidenceGaps } from '../../data/competitive-workspace-contracts';

@Component({
  selector: 'app-evidence-gaps-pane',
  imports: [ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    @if (result().items.length) {
      <ul class="space-y-2">
        @for (
          gap of result().items;
          track gap.configurationId + ':' + gap.attributeCode
        ) {
          <li class="space-y-2 rounded-lg border p-3">
            <p class="text-sm font-medium">
              {{ configurationLabel(gap.configurationId) }} ·
              {{ attributeLabel(gap.attributeCode) }}
            </p>
            <p class="text-sm text-muted-foreground">
              {{
                gap.knowledgeStatus === 'CONFLICTING'
                  ? 'Conflicting observations'
                  : 'Not reported'
              }}
              · {{ gap.observationCount }} observations
            </p>
            @if (gap.reason) {
              <p class="text-sm">{{ gap.reason }}</p>
            }
            <button
              z-button
              zType="outline"
              zSize="sm"
              [zDisabled]="!enabled()"
              (click)="
                investigateRequested.emit({
                  configurationId: gap.configurationId,
                  attributeCode: gap.attributeCode,
                })
              "
            >
              Investigate this gap
            </button>
          </li>
        }
      </ul>
    } @else {
      <p class="rounded-lg bg-muted p-3 text-sm">
        No missing or conflicting cells were found for these selected
        attributes. Source coverage still depends on the evidence available.
      </p>
    }
  `,
})
export class EvidenceGapsPane {
  readonly result = input.required<EvidenceGaps>();
  readonly enabled = input(true);
  readonly investigateRequested = output<{
    configurationId: string;
    attributeCode: string;
  }>();
  protected configurationLabel(id: string): string {
    const vehicle = this.result().comparison.configurations.find(
      (item) => item.id === id,
    );
    return vehicle ? `${vehicle.brand} ${vehicle.model} · ${vehicle.name}` : id;
  }
  protected attributeLabel(code: string): string {
    return (
      this.result().comparison.rows.find((row) => row.attribute.code === code)
        ?.attribute.label ?? code
    );
  }
}
