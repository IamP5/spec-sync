import { computed, Injectable, signal } from '@angular/core';

import type { IngestionRunSummary } from '../../vehicles/api/contracts';

/**
 * Import runs the curator started or opened in this browser session, as the
 * chat cards report them. `ChatAgentClient` hands the list to the agent as
 * context on every run, so "how is the import going?" can be answered from
 * persisted status without a tool call and without any credential.
 */
@Injectable({ providedIn: 'root' })
export class IngestionActivity {
  private readonly _runs = signal<ReadonlyMap<string, IngestionRunSummary>>(
    new Map(),
  );

  /** Newest report per run id. */
  readonly runs = computed(() => [...this._runs().values()]);

  report(summary: IngestionRunSummary): void {
    this._runs.update((runs) => {
      const previous = runs.get(summary.id);
      if (previous && JSON.stringify(previous) === JSON.stringify(summary))
        return runs;
      return new Map(runs).set(summary.id, summary);
    });
  }

  clear(): void {
    this._runs.set(new Map());
  }
}
