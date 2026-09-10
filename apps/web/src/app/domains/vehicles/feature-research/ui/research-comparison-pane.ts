import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowRight,
  lucideFileText,
  lucideLayers,
  lucideUsers,
} from '@ng-icons/lucide';

import { ZardButtonComponent } from '@/ui/components/button';

import type { ResearchSnapshot } from '../../data/research-contracts';
import { researchIsActive } from '../../data/research-contracts';
import {
  researchClaimValue,
  researchComparisonRows,
  type ResearchEvidenceFocus,
  researchStage,
} from '../../data/research-presentation';

/** Source-backed research journal; interactions are typed intents owned by the feature. */
@Component({
  selector: 'app-research-comparison-pane',
  imports: [NgTemplateOutlet, NgIcon, ZardButtonComponent],
  viewProviders: [
    provideIcons({
      lucideArrowRight,
      lucideFileText,
      lucideLayers,
      lucideUsers,
    }),
  ],
  templateUrl: './research-comparison-pane.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
})
export class ResearchComparisonPane {
  readonly research = input.required<ResearchSnapshot>();
  readonly updating = input(false);
  readonly error = input('');
  readonly evidenceRequested = output<ResearchEvidenceFocus | null>();
  readonly peopleRequested = output<void>();
  readonly refreshRequested = output<void>();
  protected readonly rows = computed(() =>
    researchComparisonRows(this.research()),
  );
  protected readonly stage = computed(() => researchStage(this.research()));
  protected readonly active = computed(() => researchIsActive(this.research()));
  protected readonly value = researchClaimValue;
  protected readonly selected = linkedSignal({
    source: () => this.research().id,
    computation: () => '',
  });
  protected readonly expanded = linkedSignal({
    source: () => this.research().id,
    computation: () => false,
  });
  protected readonly comparing = linkedSignal({
    source: () => this.research().id,
    computation: () => false,
  });
  protected readonly selectedIndex = computed(() => {
    const configurations = this.research().configurations;
    const selected = configurations.findIndex(
      (item) => item.name === this.selected(),
    );
    if (selected >= 0) return selected;
    const requested = this.research().request.configurations;
    const match = configurations.findIndex((item) =>
      requested.some(
        (name) =>
          name.trim().toLocaleLowerCase() ===
          item.name.trim().toLocaleLowerCase(),
      ),
    );
    return Math.max(0, match);
  });
  protected readonly configuration = computed(
    () => this.research().configurations[this.selectedIndex()],
  );
  protected readonly findings = computed(() =>
    this.research().configurations.reduce(
      (count, item) => count + item.claims.length,
      0,
    ),
  );
  protected readonly unmapped = computed(() =>
    this.research().configurations.reduce(
      (count, item) => count + (item.unmappedObservations?.length ?? 0),
      0,
    ),
  );
  protected readonly visibleRows = computed(() =>
    this.expanded() ? this.rows() : this.rows().slice(0, 6),
  );
  protected readonly terminalError = computed(() =>
    ['FAILED', 'REJECTED'].includes(this.research().status)
      ? this.research().error
      : null,
  );
  protected readonly qualifiers = (values: Record<string, string>) =>
    Object.entries(values)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' · ');
}
