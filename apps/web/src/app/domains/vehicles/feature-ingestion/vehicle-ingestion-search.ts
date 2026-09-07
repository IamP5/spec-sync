import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideRefreshCw } from '@ng-icons/lucide';

import { ZardBadgeComponent } from '@/ui/components/badge';
import { ZardButtonComponent } from '@/ui/components/button';
import { ZardSkeletonComponent } from '@/ui/components/skeleton';
import { ZardTableImports } from '@/ui/components/table';

import type { IngestionSummary } from '../data/ingestion-contracts';
import { runStage, runTitle, scopeLabel } from './ingestion-presentation';
import { IngestionSearchStore } from './ingestion-search-store';

/** The curator's imports, newest first; opening one is left to the host. */
@Component({
  selector: 'app-vehicle-ingestion-search',
  imports: [
    NgIcon,
    ZardBadgeComponent,
    ZardButtonComponent,
    ZardSkeletonComponent,
    ...ZardTableImports,
  ],
  providers: [IngestionSearchStore],
  viewProviders: [provideIcons({ lucideRefreshCw })],
  templateUrl: './vehicle-ingestion-search.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0 w-full' },
})
export class VehicleIngestionSearch {
  readonly opened = output<string>();

  protected readonly store = inject(IngestionSearchStore);
  protected readonly runs = computed<IngestionSummary[]>(
    () => this.store.runsValue() ?? [],
  );
  protected readonly loading = this.store.runsIsLoading;
  protected readonly failed = computed(() => !!this.store.runsError());
  protected readonly hasKey = this.store.hasKey;

  protected stage(summary: IngestionSummary) {
    return runStage(summary.status);
  }
  protected title(summary: IngestionSummary): string {
    return runTitle(summary.request);
  }
  protected scope(summary: IngestionSummary): string {
    return scopeLabel(summary.request.configurations);
  }
  protected when(summary: IngestionSummary): string {
    const date = new Date(summary.updatedAt);
    return Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        });
  }

  reload(): void {
    this.store.reload();
  }
}
